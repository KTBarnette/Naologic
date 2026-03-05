import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { workCenters as sampleWorkCenters, workOrders as sampleWorkOrders } from '../data/sample-documents';
import { generateWorkCenters, generateWorkOrders } from '../data/stress-documents';
import { WorkCenterDocument, WorkOrderDocument, WorkOrderStatus } from '../types/docs';

/** Supported timeline zoom levels. */
type Timescale = 'day' | 'week' | 'month';

/** Rendered timeline column metadata for header labels and date ranges. */
type TimelineColumn = {
  key: string;
  startUtcDay: number;
  endUtcDay: number;
  topLabel: string;
  bottomLabel: string;
  containsToday: boolean;
};

/** Floating actions menu position + target work order id. */
type ActionsMenuState = {
  workOrderId: string;
  leftPx: number;
  topPx: number;
};

/** URL flag for stress testing with generated data. */
const STRESS_MODE = new URLSearchParams(globalThis.location?.search ?? '').has('stress');
/** Size of stress-mode work center dataset. */
const STRESS_WORK_CENTER_COUNT = 50;
/** Size of stress-mode work order dataset. */
const STRESS_WORK_ORDER_COUNT = 10000;
/** Start date range used to generate stress-mode work orders. */
const STRESS_RANGE_START_ISO = '2025-01-01';
/** End date range used to generate stress-mode work orders. */
const STRESS_RANGE_END_ISO = '2027-12-31';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, NgbDatepickerModule],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  readonly DEBUG_FREEZE = false;
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
  private validationRecomputeQueued = false;
  private readonly debugStartedAtMs = globalThis.performance.now();
  private debugOverlapComputeCount = 0;
  private debugDateRangeComputeCount = 0;
  private debugStartDateStructCount = 0;
  private debugEndDateStructCount = 0;

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
  @ViewChild('timelineScrollPanel') private readonly timelineScrollPanelRef?: ElementRef<HTMLElement>;
  startDateStructValue: NgbDateStruct | null = null;
  endDateStructValue: NgbDateStruct | null = null;
  dateRangeErrorText: string | null = null;
  overlapErrorText: string | null = null;
  readonly workOrderForm;

  /** Initializes datasets, form controls, derived state, and timeline columns. */
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
    this.workOrderForm.valueChanges.subscribe(() => {
      this.scheduleValidationRecompute();
    });
    this.recomputeDerivedFormState();
    this.rebuildColumns();
  }

  /** Returns active timeline column width in pixels based on selected timescale. */
  get colWidthPx(): number {
    if (this.timescale === 'week') {
      return this.weekColWidthPx;
    }
    if (this.timescale === 'month') {
      return this.monthColWidthPx;
    }
    return this.dayColWidthPx;
  }

  /** Changes timeline timescale and rebuilds visible columns when needed. */
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

  /** TrackBy function for timeline columns to avoid unnecessary re-renders. */
  trackByCol(_: number, col: TimelineColumn): string {
    return col.key;
  }

  /** Pixel offset of current local time within the UTC-based timeline axis. */
  get todayOffsetPx(): number {
    const now = new Date();
    const nowLocalDayFloat = this.toUtcDay(now) + this.localDayFraction(now);
    return this.utcDayToPx(nowLocalDayFloat);
  }

  /** Left pixel offset for a work-order bar from its start date. */
  barLeftPx(workOrder: WorkOrderDocument): number {
    const orderStartDay = this.isoToUtcDay(workOrder.startsAtIso);
    return this.utcDayToPx(orderStartDay);
  }

  /** Width of a work-order bar in pixels including the end day. */
  barWidthPx(workOrder: WorkOrderDocument): number {
    const startUtcDay = this.isoToUtcDay(workOrder.startsAtIso);
    const endExclusiveUtcDay = this.isoToUtcDay(workOrder.endsAtIso) + 1;
    return this.utcDayToPx(endExclusiveUtcDay) - this.utcDayToPx(startUtcDay);
  }

  /** Returns work orders for one center, filtered to visible timeline range. */
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

  /** Side panel title shown in both create and edit mode. */
  get panelTitle(): string {
    return 'Work Order Details';
  }

  /** Save button state derived from form validity and custom validations. */
  get canSave(): boolean {
    return this.workOrderForm.valid && !this.dateRangeErrorText && !this.overlapErrorText;
  }

  /** Opens create panel by translating click position to a start date. */
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

  /** Opens edit panel when a work-order bar is clicked. */
  onWorkOrderClick(event: MouseEvent, workOrder: WorkOrderDocument): void {
    event.stopPropagation();
    this.closeActionsMenu();
    this.openEditPanel(workOrder);
  }

  /** Keyboard activation for work-order bars (Enter/Space). */
  onWorkOrderKeydown(event: KeyboardEvent, workOrder: WorkOrderDocument): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closeActionsMenu();
    this.openEditPanel(workOrder);
  }

  /** Toggles floating actions menu anchored to a work-order kebab button. */
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

  /** Opens editor from actions menu for selected work order. */
  onActionsMenuEdit(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const id = this.actionsMenu?.workOrderId;
    this.actionsMenu = null;
    if (!id) {
      return;
    }
    const wo = this.workOrders.find((w) => w.id === id);
    if (!wo) {
      return;
    }
    this.openEditPanel(wo);
  }

  /** Deletes selected work order from the actions menu. */
  onActionsMenuDelete(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const id = this.actionsMenu?.workOrderId;
    this.actionsMenu = null;
    if (!id) {
      return;
    }
    this.deleteWorkOrderById(id);
  }

  /** Scrolls timeline so today's position is close to viewport center. */
  scrollToToday(): void {
    const timelinePanel = this.timelineScrollPanelRef?.nativeElement;
    if (!timelinePanel) {
      return;
    }
    const maxScrollLeft = Math.max(0, timelinePanel.scrollWidth - timelinePanel.clientWidth);
    const target = this.todayOffsetPx - timelinePanel.clientWidth / 2;
    timelinePanel.scrollTo({ left: Math.min(maxScrollLeft, Math.max(0, target)), behavior: 'smooth' });
  }

  /** Closes actions menu when clicking anywhere outside of it. */
  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (this.isInsideNgSelect(event)) {
      return;
    }
    if (!this.actionsMenu) {
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest('.floating-actions-menu') || target?.closest('.work-order-kebab')) {
      return;
    }
    this.closeActionsMenu();
  }

  /** Checks whether event target is inside ng-select control or its body-appended dropdown. */
  private isInsideNgSelect(event: Event): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    if (target.closest('ng-select')) {
      return true;
    }
    if (target.closest('.ng-dropdown-panel')) {
      return true;
    }
    if (target.closest('.ng-select')) {
      return true;
    }
    return false;
  }

  /** Opens panel in edit mode and hydrates form from work-order data. */
  private openEditPanel(workOrder: WorkOrderDocument): void {
    if (this.DEBUG_FREEZE) {
      console.log('[freeze-debug] openEditPanel workOrderId:', workOrder.id);
      console.time('openEditPanel');
    }
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
    this.recomputeDerivedFormState();
    if (this.DEBUG_FREEZE) {
      console.timeEnd('openEditPanel');
    }
  }

  /** Shows row hover hint unless pointer is over interactive row content. */
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

  /** Clears row hover hint when leaving a timeline row. */
  onTimelineRowLeave(workCenterId: string): void {
    if (this.hoverWorkCenterId === workCenterId) {
      this.hoverWorkCenterId = null;
    }
  }

  /** Syncs start datepicker selection into form ISO field. */
  onStartDatePicked(date: NgbDateStruct | null): void {
    const selectedStart = date ? this.cloneDateStruct(date) : null;
    this.startDateStructValue = selectedStart;
    const startIso = selectedStart ? this.structToIsoDateOnly(selectedStart) : '';
    this.workOrderForm.controls.startsAtIso.setValue(startIso);
    this.workOrderForm.controls.startsAtIso.markAsTouched();
    if (!selectedStart || !this.endDateStructValue) {
      return;
    }
    if (this.structToDate(selectedStart).getTime() <= this.structToDate(this.endDateStructValue).getTime()) {
      return;
    }
    this.endDateStructValue = this.cloneDateStruct(selectedStart);
    this.workOrderForm.controls.endsAtIso.setValue(startIso);
    this.workOrderForm.controls.endsAtIso.markAsTouched();
  }

  /** Syncs end datepicker selection into form ISO field. */
  onEndDatePicked(date: NgbDateStruct | null): void {
    const selectedEnd = date ? this.cloneDateStruct(date) : null;
    this.endDateStructValue = selectedEnd;
    if (!selectedEnd) {
      this.workOrderForm.controls.endsAtIso.setValue('');
      this.workOrderForm.controls.endsAtIso.markAsTouched();
      return;
    }
    const startsAt = this.startDateStructValue;
    if (startsAt && this.structToDate(selectedEnd).getTime() < this.structToDate(startsAt).getTime()) {
      this.endDateStructValue = this.cloneDateStruct(startsAt);
      this.workOrderForm.controls.endsAtIso.setValue(this.structToIsoDateOnly(startsAt));
      this.workOrderForm.controls.endsAtIso.markAsTouched();
      return;
    }
    this.workOrderForm.controls.endsAtIso.setValue(this.structToIsoDateOnly(selectedEnd));
    this.workOrderForm.controls.endsAtIso.markAsTouched();
  }

  /** Tooltip content for a work-order bar. */
  formatWorkOrderTooltip(workOrder: WorkOrderDocument): string {
    return `${workOrder.name}\n${workOrder.status}\n${workOrder.startsAtIso} -> ${workOrder.endsAtIso}`;
  }

  /** User-facing status label shown in ng-select options and selected value pill. */
  statusLabel(status: WorkOrderStatus): string {
    if (status === 'in-progress') {
      return 'In progress';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /** Handles Escape key for dismissing menu first, then side panel. */
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

  /** Resets and closes the create/edit side panel. */
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
    this.recomputeDerivedFormState();
    this.workOrderForm.markAsPristine();
    this.workOrderForm.markAsUntouched();
  }

  /** Creates or updates work order based on current panel mode. */
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

  /** Deletes work order currently being edited in side panel. */
  deleteWorkOrder(): void {
    if (!this.editingWorkOrderId) {
      return;
    }
    this.deleteWorkOrderById(this.editingWorkOrderId);
  }

  /** Removes a work order by id and refreshes grouped timeline data. */
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

  /** Rebuilds lookup map of work orders grouped by work center id. */
  private rebuildWorkOrderGroups(): void {
    const grouped: Record<string, WorkOrderDocument[]> = {};
    for (const workOrder of this.workOrders) {
      const existing = grouped[workOrder.workCenterId] ?? [];
      existing.push(workOrder);
      grouped[workOrder.workCenterId] = existing;
    }
    this.workOrdersByWorkCenterId = grouped;
    this.scheduleValidationRecompute();
  }

  /** Recomputes timeline columns for current timescale. */
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

  /** Builds +/-14 day columns around today. */
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

  /** Builds +/-8 week columns around current week. */
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

  /** Builds +/-6 month columns around current month. */
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

  /** Converts UTC day value to X position in current column scale. */
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

  /** Converts UTC day number to UTC date object. */
  private utcDayToDate(utcDay: number): Date {
    return new Date(utcDay * this.msPerDay);
  }

  /** Converts X pixel coordinate back to fractional UTC day. */
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

  /** Returns Monday-based start-of-week UTC day for a given UTC day. */
  private startOfWeekUtcDay(utcDay: number): number {
    const dow = this.utcDayToDate(utcDay).getUTCDay();
    const daysSinceMonday = (dow + 6) % 7;
    return utcDay - daysSinceMonday;
  }

  /** Returns elapsed fraction of local current day. */
  private localDayFraction(now: Date): number {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const elapsedMs = now.getTime() - startOfDay.getTime();
    return elapsedMs / this.msPerDay;
  }

  /** Parses ISO date string (YYYY-MM-DD) to UTC day number. */
  private isoToUtcDay(isoDate: string): number {
    const [year, month, day] = isoDate.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / this.msPerDay;
  }

  /** Formats UTC day number to ISO date string (YYYY-MM-DD). */
  private utcDayToIso(utcDay: number): string {
    const d = this.utcDayToDate(utcDay);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Converts local calendar date to corresponding UTC day index. */
  private toUtcDay(d: Date): number {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / this.msPerDay;
  }

  /** Opens side panel in create mode with default 7-day date window. */
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
    this.recomputeDerivedFormState();
  }

  /** Repositions hover hint pill relative to cursor location in row. */
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

  /** Detects whether pointer is currently over row interactive controls. */
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

  /** Closes floating work-order actions menu. */
  private closeActionsMenu(): void {
    this.actionsMenu = null;
  }

  /** Finds work order by id, returning null when absent. */
  private findWorkOrderById(id: string): WorkOrderDocument | null {
    return this.workOrders.find((w) => w.id === id) ?? null;
  }

  /** Queues a single microtask to recompute form-derived validation state. */
  private scheduleValidationRecompute(): void {
    if (this.validationRecomputeQueued) {
      return;
    }
    this.validationRecomputeQueued = true;
    queueMicrotask(() => {
      this.validationRecomputeQueued = false;
      this.recomputeDerivedFormState();
    });
  }

  /** Recomputes datepicker models and custom validation error text. */
  private recomputeDerivedFormState(): void {
    const startsAtIso = this.workOrderForm.controls.startsAtIso.value ?? '';
    const endsAtIso = this.workOrderForm.controls.endsAtIso.value ?? '';
    this.startDateStructValue = this.isoToDateStruct(startsAtIso);
    this.endDateStructValue = this.isoToDateStruct(endsAtIso);
    if (this.DEBUG_FREEZE) {
      this.debugStartDateStructCount += 1;
      this.debugEndDateStructCount += 1;
      if (this.debugStartDateStructCount % 200 === 0) {
        const elapsed = Math.round(globalThis.performance.now() - this.debugStartedAtMs);
        console.log('[freeze-debug] startDateStruct recompute count:', this.debugStartDateStructCount, 'elapsedMs:', elapsed);
      }
      if (this.debugEndDateStructCount % 200 === 0) {
        const elapsed = Math.round(globalThis.performance.now() - this.debugStartedAtMs);
        console.log('[freeze-debug] endDateStruct recompute count:', this.debugEndDateStructCount, 'elapsedMs:', elapsed);
      }
    }

    this.dateRangeErrorText = this.computeDateRangeErrorText(startsAtIso, endsAtIso);
    this.overlapErrorText = this.computeOverlapErrorText(startsAtIso, endsAtIso);
  }

  /** Validates start/end date ordering for current form values. */
  private computeDateRangeErrorText(startsAtIso: string, endsAtIso: string): string | null {
    if (this.DEBUG_FREEZE) {
      this.debugDateRangeComputeCount += 1;
      if (this.debugDateRangeComputeCount % 200 === 0) {
        const elapsed = Math.round(globalThis.performance.now() - this.debugStartedAtMs);
        console.log('[freeze-debug] formDateRangeError count:', this.debugDateRangeComputeCount, 'elapsedMs:', elapsed);
      }
    }

    if (!startsAtIso || !endsAtIso) {
      return null;
    }
    if (this.isoToUtcDay(endsAtIso) < this.isoToUtcDay(startsAtIso)) {
      return 'End date must be on or after start date.';
    }
    return null;
  }

  /** Validates work-order overlap conflicts within the same work center. */
  private computeOverlapErrorText(startsAtIso: string, endsAtIso: string): string | null {
    if (this.DEBUG_FREEZE) {
      this.debugOverlapComputeCount += 1;
      if (this.debugOverlapComputeCount % 50 === 0) {
        const elapsed = Math.round(globalThis.performance.now() - this.debugStartedAtMs);
        console.log('[freeze-debug] overlapError count:', this.debugOverlapComputeCount, 'elapsedMs:', elapsed);
      }
    }

    if (!this.panelWorkCenterId || !startsAtIso || !endsAtIso || this.dateRangeErrorText) {
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

  /** Converts ISO date string to ng-bootstrap date struct. */
  private isoToDateStruct(iso: string): NgbDateStruct | null {
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return { year, month, day };
  }

  /** Converts ng-bootstrap date struct into local Date for comparisons. */
  private structToDate(date: NgbDateStruct): Date {
    return new Date(date.year, date.month - 1, date.day);
  }

  /** Clones ng-bootstrap date struct to avoid shared object references between pickers. */
  private cloneDateStruct(date: NgbDateStruct): NgbDateStruct {
    return { year: date.year, month: date.month, day: date.day };
  }

  /** Converts ng-bootstrap date struct to ISO date string (YYYY-MM-DD). */
  private structToIsoDateOnly(date: NgbDateStruct): string {
    const yyyy = String(date.year).padStart(4, '0');
    const mm = String(date.month).padStart(2, '0');
    const dd = String(date.day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Adds whole days to ISO date string and returns resulting ISO date. */
  private addDaysToIso(iso: string, days: number): string {
    return this.utcDayToIso(this.isoToUtcDay(iso) + days);
  }

  /** Resolves work center name from id, falling back to id when missing. */
  private findWorkCenterName(workCenterId: string): string {
    return this.workCenters.find((center) => center.id === workCenterId)?.name ?? workCenterId;
  }

  /** Finds first overlapping work order in a center, excluding optional id. */
  private findOverlap(
    workCenterId: string,
    startUtcDay: number,
    endUtcDay: number,
    skipWorkOrderId: string | null
  ): WorkOrderDocument | null {
    const centerWorkOrders = this.workOrdersByWorkCenterId[workCenterId] ?? [];
    for (const existing of centerWorkOrders) {
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

  /** Generates next numeric work-order id in `wo-0000` format. */
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
