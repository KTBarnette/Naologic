import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { workCenters as sampleWorkCenters, workOrders as sampleWorkOrders } from '../data/sample-documents';
import { generateWorkCenters, generateWorkOrders } from '../data/stress-documents';
import { WorkCenterDocument, WorkOrderDocument, WorkOrderStatus } from '../types/docs';

type Timescale = 'day' | 'week' | 'month';

type TimelineColumn = {
  key: string;
  startUtcDay: number;
  endUtcDay: number;
  topLabel: string;
  bottomLabel: string;
  containsToday: boolean;
};

type ActionsMenuState = {
  workOrderId: string;
  leftPx: number;
  topPx: number;
};

const STRESS_MODE = new URLSearchParams(globalThis.location?.search ?? '').has('stress');
const STRESS_WORK_CENTER_COUNT = 50;
const STRESS_WORK_ORDER_COUNT = 10000;
const STRESS_RANGE_START_ISO = '2025-01-01';
const STRESS_RANGE_END_ISO = '2027-12-31';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, NgbDatepickerModule],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  readonly workCenters: WorkCenterDocument[];
  readonly workOrders: WorkOrderDocument[];

  readonly dayColWidthPx = 84;
  readonly weekColWidthPx = 168;
  readonly monthColWidthPx = 224;
  readonly timescaleOptions: Timescale[] = ['day', 'week', 'month'];
  readonly statusOptions: WorkOrderStatus[] = ['open', 'in-progress', 'complete', 'blocked'];
  private readonly msPerDay = 1000 * 60 * 60 * 24;
  private readonly dayTopFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
  private readonly dayBottomFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  private readonly weekTopFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  private readonly monthTopFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  private readonly monthBottomFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });
  private workOrdersByWorkCenterId: Partial<Record<string, WorkOrderDocument[]>> = {};

  timescale: Timescale = 'day';
  visibleColumns: TimelineColumn[] = [];
  panelOpen = false;
  panelMode: 'create' | 'edit' = 'create';
  panelWorkCenterId = '';
  panelWorkCenterName = '';
  editingWorkOrderId: string | null = null;
  saveError: string | null = null;
  hoverWorkCenterId: string | null = null;
  hoverHintLeftPx = 0;
  actionsMenu: ActionsMenuState | null = null;
  readonly workOrderForm;

  constructor(private readonly formBuilder: FormBuilder) {
    if (STRESS_MODE) {
      this.workCenters = generateWorkCenters(STRESS_WORK_CENTER_COUNT);
      this.workOrders = generateWorkOrders(
        STRESS_WORK_ORDER_COUNT,
        this.workCenters,
        STRESS_RANGE_START_ISO,
        STRESS_RANGE_END_ISO
      );
    } else {
      this.workCenters = [...sampleWorkCenters];
      this.workOrders = [...sampleWorkOrders];
    }
    this.rebuildWorkOrderGroups();
    this.workOrderForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(80)]],
      status: ['open' as WorkOrderStatus, Validators.required],
      startsAtIso: ['', Validators.required],
      endsAtIso: ['', Validators.required]
    });
    this.rebuildColumns();
  }

  get colWidthPx(): number {
    if (this.timescale === 'week') {
      return this.weekColWidthPx;
    }
    if (this.timescale === 'month') {
      return this.monthColWidthPx;
    }
    return this.dayColWidthPx;
  }

  setTimescale(next: string): void {
    if (next !== 'day' && next !== 'week' && next !== 'month') {
      return;
    }
    if (this.timescale === next) {
      return;
    }
    this.timescale = next;
    this.rebuildColumns();
  }

  trackByCol(_: number, col: TimelineColumn): string {
    return col.key;
  }

  get todayOffsetPx(): number {
    const now = new Date();
    const nowLocalDayFloat = this.toUtcDay(now) + this.localDayFraction(now);
    return this.utcDayToPx(nowLocalDayFloat);
  }

  barLeftPx(workOrder: WorkOrderDocument): number {
    const orderStartDay = this.isoToUtcDay(workOrder.startsAtIso);
    return this.utcDayToPx(orderStartDay);
  }

  barWidthPx(workOrder: WorkOrderDocument): number {
    const startUtcDay = this.isoToUtcDay(workOrder.startsAtIso);
    const endExclusiveUtcDay = this.isoToUtcDay(workOrder.endsAtIso) + 1;
    return this.utcDayToPx(endExclusiveUtcDay) - this.utcDayToPx(startUtcDay);
  }

  visibleWorkOrdersForCenter(centerId: string): WorkOrderDocument[] {
    const grouped = this.workOrdersByWorkCenterId[centerId] ?? [];
    if (this.visibleColumns.length === 0) {
      return grouped;
    }
    const rangeStartUtcDay = this.visibleColumns[0].startUtcDay;
    const rangeEndUtcDay = this.visibleColumns[this.visibleColumns.length - 1].endUtcDay - 1;
    return grouped.filter((workOrder) => {
      const orderStartUtcDay = this.isoToUtcDay(workOrder.startsAtIso);
      const orderEndUtcDay = this.isoToUtcDay(workOrder.endsAtIso);
      return orderEndUtcDay >= rangeStartUtcDay && orderStartUtcDay <= rangeEndUtcDay;
    });
  }

  get panelTitle(): string {
    return 'Work Order Details';
  }

  get startDateStruct(): NgbDateStruct | null {
    return this.isoToDateStruct(this.workOrderForm.controls.startsAtIso.value ?? '');
  }

  get endDateStruct(): NgbDateStruct | null {
    return this.isoToDateStruct(this.workOrderForm.controls.endsAtIso.value ?? '');
  }

  get formDateRangeError(): string | null {
    const startsAtIso = this.workOrderForm.controls.startsAtIso.value ?? '';
    const endsAtIso = this.workOrderForm.controls.endsAtIso.value ?? '';
    if (!startsAtIso || !endsAtIso) {
      return null;
    }
    if (this.isoToUtcDay(endsAtIso) < this.isoToUtcDay(startsAtIso)) {
      return 'End date must be on or after start date.';
    }
    return null;
  }

  get overlapError(): string | null {
    const startsAtIso = this.workOrderForm.controls.startsAtIso.value ?? '';
    const endsAtIso = this.workOrderForm.controls.endsAtIso.value ?? '';
    if (!this.panelWorkCenterId || !startsAtIso || !endsAtIso) {
      return null;
    }
    if (this.formDateRangeError) {
      return null;
    }

    const startUtcDay = this.isoToUtcDay(startsAtIso);
    const endUtcDay = this.isoToUtcDay(endsAtIso);
    const overlap = this.findOverlap(this.panelWorkCenterId, startUtcDay, endUtcDay, this.editingWorkOrderId);

    if (!overlap) {
      return null;
    }
    return `Overlaps with "${overlap.name}" (${overlap.startsAtIso} to ${overlap.endsAtIso}).`;
  }

  get canSave(): boolean {
    return this.workOrderForm.valid && !this.formDateRangeError && !this.overlapError;
  }

  onTimelineRowClick(event: MouseEvent, workCenterId: string): void {
    this.closeActionsMenu();
    if (this.visibleColumns.length === 0) {
      return;
    }

    const rowElement = event.currentTarget as HTMLElement | null;
    if (!rowElement) {
      return;
    }

    const rect = rowElement.getBoundingClientRect();
    const rowWidth = this.visibleColumns.length * this.colWidthPx;
    const px = Math.min(Math.max(event.clientX - rect.left, 0), rowWidth - 1);
    const utcDay = Math.floor(this.pxToUtcDay(px));
    const startIso = this.utcDayToIso(utcDay);
    this.openCreatePanel(workCenterId, startIso);
  }

  onWorkOrderClick(event: MouseEvent, workOrder: WorkOrderDocument): void {
    event.stopPropagation();
    this.closeActionsMenu();
    this.openEditPanel(workOrder);
  }

  onWorkOrderKeydown(event: KeyboardEvent, workOrder: WorkOrderDocument): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closeActionsMenu();
    this.openEditPanel(workOrder);
  }

  onWorkOrderActionsToggle(event: MouseEvent, workOrderId: string): void {
    event.stopPropagation();
    const kebabButton = event.currentTarget as HTMLElement | null;
    if (!kebabButton) {
      return;
    }

    if (this.actionsMenu?.workOrderId === workOrderId) {
      this.closeActionsMenu();
      return;
    }

    const timelinePanel = kebabButton.closest('.timeline-panel') as HTMLElement | null;
    if (!timelinePanel) {
      return;
    }

    const buttonRect = kebabButton.getBoundingClientRect();
    const panelRect = timelinePanel.getBoundingClientRect();
    this.actionsMenu = {
      workOrderId,
      leftPx: buttonRect.right - panelRect.left + timelinePanel.scrollLeft,
      topPx: buttonRect.bottom - panelRect.top + timelinePanel.scrollTop + 6
    };
  }

  onFloatingActionsEdit(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.actionsMenu) {
      return;
    }
    const workOrder = this.findWorkOrderById(this.actionsMenu.workOrderId);
    this.closeActionsMenu();
    if (!workOrder) {
      return;
    }
    this.openEditPanel(workOrder);
  }

  onFloatingActionsDelete(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.actionsMenu) {
      return;
    }
    const workOrderId = this.actionsMenu.workOrderId;
    this.closeActionsMenu();
    this.deleteWorkOrderById(workOrderId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.actionsMenu) {
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest('.work-order-actions') || target?.closest('.floating-actions-menu')) {
      return;
    }
    this.closeActionsMenu();
  }

  private openEditPanel(workOrder: WorkOrderDocument): void {
    this.panelMode = 'edit';
    this.panelOpen = true;
    this.editingWorkOrderId = workOrder.id;
    this.panelWorkCenterId = workOrder.workCenterId;
    this.panelWorkCenterName = this.findWorkCenterName(workOrder.workCenterId);
    this.saveError = null;
    this.workOrderForm.reset({
      name: workOrder.name,
      status: workOrder.status,
      startsAtIso: workOrder.startsAtIso,
      endsAtIso: workOrder.endsAtIso
    });
  }

  onTimelineRowHover(event: MouseEvent, workCenterId: string): void {
    if (this.isHoveringInteractiveElement(event) || this.actionsMenu) {
      if (this.hoverWorkCenterId === workCenterId) {
        this.hoverWorkCenterId = null;
      }
      return;
    }
    this.hoverWorkCenterId = workCenterId;
    this.updateHoverHintPosition(event);
  }

  onTimelineRowLeave(workCenterId: string): void {
    if (this.hoverWorkCenterId === workCenterId) {
      this.hoverWorkCenterId = null;
    }
  }

  onStartDatePicked(date: NgbDateStruct | null): void {
    this.workOrderForm.controls.startsAtIso.setValue(this.dateStructToIso(date));
    this.workOrderForm.controls.startsAtIso.markAsTouched();
  }

  onEndDatePicked(date: NgbDateStruct | null): void {
    this.workOrderForm.controls.endsAtIso.setValue(this.dateStructToIso(date));
    this.workOrderForm.controls.endsAtIso.markAsTouched();
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.actionsMenu) {
      this.closeActionsMenu();
      return;
    }
    if (this.panelOpen) {
      this.closePanel();
    }
  }

  closePanel(): void {
    this.panelOpen = false;
    this.panelMode = 'create';
    this.panelWorkCenterId = '';
    this.panelWorkCenterName = '';
    this.editingWorkOrderId = null;
    this.saveError = null;
    this.workOrderForm.reset({
      name: '',
      status: 'open',
      startsAtIso: '',
      endsAtIso: ''
    });
    this.workOrderForm.markAsPristine();
    this.workOrderForm.markAsUntouched();
  }

  saveWorkOrder(): void {
    this.workOrderForm.markAllAsTouched();
    this.saveError = null;

    if (!this.canSave || !this.panelWorkCenterId) {
      return;
    }

    const raw = this.workOrderForm.getRawValue();
    const payload = {
      workCenterId: this.panelWorkCenterId,
      name: (raw.name ?? '').trim(),
      status: raw.status as WorkOrderStatus,
      startsAtIso: raw.startsAtIso ?? '',
      endsAtIso: raw.endsAtIso ?? ''
    };

    if (!payload.name) {
      this.saveError = 'Name is required.';
      return;
    }

    if (this.panelMode === 'edit' && this.editingWorkOrderId) {
      const index = this.workOrders.findIndex((item) => item.id === this.editingWorkOrderId);
      if (index < 0) {
        this.saveError = 'Work order not found.';
        return;
      }
      this.workOrders[index] = { ...this.workOrders[index], ...payload };
    } else {
      this.workOrders.push({
        id: this.nextWorkOrderId(),
        ...payload
      });
    }

    this.rebuildWorkOrderGroups();
    this.closePanel();
  }

  deleteWorkOrder(): void {
    if (!this.editingWorkOrderId) {
      return;
    }
    this.deleteWorkOrderById(this.editingWorkOrderId);
  }

  deleteWorkOrderById(workOrderId: string): void {
    const index = this.workOrders.findIndex((item) => item.id === workOrderId);
    if (index < 0) {
      return;
    }
    this.workOrders.splice(index, 1);
    this.rebuildWorkOrderGroups();
    if (this.editingWorkOrderId === workOrderId) {
      this.closePanel();
      return;
    }
    this.closeActionsMenu();
  }

  private rebuildWorkOrderGroups(): void {
    const grouped: Record<string, WorkOrderDocument[]> = {};
    for (const workOrder of this.workOrders) {
      const existing = grouped[workOrder.workCenterId] ?? [];
      existing.push(workOrder);
      grouped[workOrder.workCenterId] = existing;
    }
    this.workOrdersByWorkCenterId = grouped;
  }

  private rebuildColumns(): void {
    const todayUtcDay = this.toUtcDay(new Date());

    if (this.timescale === 'week') {
      this.visibleColumns = this.buildWeekColumns(todayUtcDay);
      return;
    }
    if (this.timescale === 'month') {
      this.visibleColumns = this.buildMonthColumns(todayUtcDay);
      return;
    }
    this.visibleColumns = this.buildDayColumns(todayUtcDay);
  }

  private buildDayColumns(todayUtcDay: number): TimelineColumn[] {
    const cols: TimelineColumn[] = [];
    for (let offset = -14; offset <= 14; offset += 1) {
      const startUtcDay = todayUtcDay + offset;
      const endUtcDay = startUtcDay + 1;
      cols.push({
        key: `d-${startUtcDay}`,
        startUtcDay,
        endUtcDay,
        topLabel: this.dayTopFormatter.format(this.utcDayToDate(startUtcDay)),
        bottomLabel: this.dayBottomFormatter.format(this.utcDayToDate(startUtcDay)),
        containsToday: startUtcDay <= todayUtcDay && todayUtcDay < endUtcDay
      });
    }
    return cols;
  }

  private buildWeekColumns(todayUtcDay: number): TimelineColumn[] {
    const cols: TimelineColumn[] = [];
    const currentWeekStartUtcDay = this.startOfWeekUtcDay(todayUtcDay);
    for (let offset = -8; offset <= 8; offset += 1) {
      const startUtcDay = currentWeekStartUtcDay + offset * 7;
      const endUtcDay = startUtcDay + 7;
      const start = this.utcDayToDate(startUtcDay);
      const endInclusive = this.utcDayToDate(endUtcDay - 1);
      cols.push({
        key: `w-${startUtcDay}`,
        startUtcDay,
        endUtcDay,
        topLabel: this.weekTopFormatter.format(start),
        bottomLabel: this.weekTopFormatter.format(endInclusive),
        containsToday: startUtcDay <= todayUtcDay && todayUtcDay < endUtcDay
      });
    }
    return cols;
  }

  private buildMonthColumns(todayUtcDay: number): TimelineColumn[] {
    const today = new Date();
    const baseYear = today.getFullYear();
    const baseMonth = today.getMonth();
    const cols: TimelineColumn[] = [];

    for (let offset = -6; offset <= 6; offset += 1) {
      const monthStartUtc = Date.UTC(baseYear, baseMonth + offset, 1) / this.msPerDay;
      const nextMonthStartUtc = Date.UTC(baseYear, baseMonth + offset + 1, 1) / this.msPerDay;
      const monthStartDate = this.utcDayToDate(monthStartUtc);
      cols.push({
        key: `m-${monthStartUtc}`,
        startUtcDay: monthStartUtc,
        endUtcDay: nextMonthStartUtc,
        topLabel: this.monthTopFormatter.format(monthStartDate),
        bottomLabel: this.monthBottomFormatter.format(monthStartDate),
        containsToday: monthStartUtc <= todayUtcDay && todayUtcDay < nextMonthStartUtc
      });
    }

    return cols;
  }

  // Map UTC day coordinates into the current zoom column pixel space.
  private utcDayToPx(utcDay: number): number {
    if (this.visibleColumns.length === 0) {
      return 0;
    }

    const first = this.visibleColumns[0];
    const last = this.visibleColumns[this.visibleColumns.length - 1];
    if (utcDay <= first.startUtcDay) {
      return 0;
    }
    if (utcDay >= last.endUtcDay) {
      return this.visibleColumns.length * this.colWidthPx;
    }

    const colIndex = this.visibleColumns.findIndex(
      (col) => utcDay >= col.startUtcDay && utcDay < col.endUtcDay
    );
    if (colIndex < 0) {
      return 0;
    }

    const col = this.visibleColumns[colIndex];
    const colSpanDays = col.endUtcDay - col.startUtcDay;
    const fractionWithinColumn = (utcDay - col.startUtcDay) / colSpanDays;
    return (colIndex + fractionWithinColumn) * this.colWidthPx;
  }

  private utcDayToDate(utcDay: number): Date {
    return new Date(utcDay * this.msPerDay);
  }

  // Inverse mapping used for click-to-create so clicked pixels resolve to UTC day.
  private pxToUtcDay(px: number): number {
    if (this.visibleColumns.length === 0) {
      return 0;
    }
    const colIndex = Math.min(
      this.visibleColumns.length - 1,
      Math.max(0, Math.floor(px / this.colWidthPx))
    );
    const col = this.visibleColumns[colIndex];
    const colStartPx = colIndex * this.colWidthPx;
    const fractionWithinCol = (px - colStartPx) / this.colWidthPx;
    return col.startUtcDay + fractionWithinCol * (col.endUtcDay - col.startUtcDay);
  }

  private startOfWeekUtcDay(utcDay: number): number {
    const dow = this.utcDayToDate(utcDay).getUTCDay();
    const daysSinceMonday = (dow + 6) % 7;
    return utcDay - daysSinceMonday;
  }

  private localDayFraction(now: Date): number {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const elapsedMs = now.getTime() - startOfDay.getTime();
    return elapsedMs / this.msPerDay;
  }

  private isoToUtcDay(isoDate: string): number {
    const [year, month, day] = isoDate.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / this.msPerDay;
  }

  private utcDayToIso(utcDay: number): string {
    const d = this.utcDayToDate(utcDay);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private toUtcDay(d: Date): number {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / this.msPerDay;
  }

  private openCreatePanel(workCenterId: string, startIso: string): void {
    const endIso = this.addDaysToIso(startIso, 7);
    this.panelMode = 'create';
    this.panelOpen = true;
    this.editingWorkOrderId = null;
    this.panelWorkCenterId = workCenterId;
    this.panelWorkCenterName = this.findWorkCenterName(workCenterId);
    this.saveError = null;
    this.workOrderForm.reset({
      name: '',
      status: 'open',
      startsAtIso: startIso,
      endsAtIso: endIso
    });
  }

  private updateHoverHintPosition(event: MouseEvent): void {
    if (this.visibleColumns.length === 0) {
      this.hoverHintLeftPx = 0;
      return;
    }
    const rowElement = event.currentTarget as HTMLElement | null;
    if (!rowElement) {
      return;
    }
    const rect = rowElement.getBoundingClientRect();
    const rowWidth = this.visibleColumns.length * this.colWidthPx;
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rowWidth);
    this.hoverHintLeftPx = x;
  }

  private isHoveringInteractiveElement(event: MouseEvent): boolean {
    const target = event.target as Element | null;
    if (!target) {
      return false;
    }
    return Boolean(
      target.closest('.work-order-bar') ||
        target.closest('.work-order-actions') ||
        target.closest('.floating-actions-menu') ||
        target.closest('.work-order-kebab')
    );
  }

  private closeActionsMenu(): void {
    this.actionsMenu = null;
  }

  private findWorkOrderById(workOrderId: string): WorkOrderDocument | null {
    return this.workOrders.find((workOrder) => workOrder.id === workOrderId) ?? null;
  }

  private isoToDateStruct(iso: string): NgbDateStruct | null {
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return { year, month, day };
  }

  private dateStructToIso(date: NgbDateStruct | null): string {
    if (!date) {
      return '';
    }
    const yyyy = String(date.year).padStart(4, '0');
    const mm = String(date.month).padStart(2, '0');
    const dd = String(date.day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private addDaysToIso(iso: string, days: number): string {
    return this.utcDayToIso(this.isoToUtcDay(iso) + days);
  }

  private findWorkCenterName(workCenterId: string): string {
    return this.workCenters.find((center) => center.id === workCenterId)?.name ?? workCenterId;
  }

  private findOverlap(
    workCenterId: string,
    startUtcDay: number,
    endUtcDay: number,
    skipWorkOrderId: string | null
  ): WorkOrderDocument | null {
    // Overlap validation is constrained to the same work center and skips the currently edited order.
    for (const existing of this.workOrders) {
      if (existing.workCenterId !== workCenterId) {
        continue;
      }
      if (skipWorkOrderId && existing.id === skipWorkOrderId) {
        continue;
      }
      const existingStart = this.isoToUtcDay(existing.startsAtIso);
      const existingEnd = this.isoToUtcDay(existing.endsAtIso);
      const overlaps = !(endUtcDay < existingStart || startUtcDay > existingEnd);
      if (overlaps) {
        return existing;
      }
    }
    return null;
  }

  private nextWorkOrderId(): string {
    let maxId = 0;
    for (const workOrder of this.workOrders) {
      const parsed = Number(workOrder.id.replace(/^wo-/, ''));
      if (Number.isFinite(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    }
    return `wo-${String(maxId + 1).padStart(4, '0')}`;
  }
}
