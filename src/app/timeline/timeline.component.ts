import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { workCenters as sampleWorkCenters, workOrders as sampleWorkOrders } from '../data/sample-documents';
import { generateWorkCenters, generateWorkOrders } from '../data/stress-documents';
import { WorkCenterDocument, WorkOrderDocument, WorkOrderStatus } from '../types/docs';

/** Supported timeline zoom levels. */
type Timescale = 'hour' | 'day' | 'week' | 'month';

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
  workCenterId: string;
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
/** Frozen reference date used to match provided design screenshot. */
const REFERENCE_ANCHOR_ISO = '2024-09-15';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, NgbDatepickerModule],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements AfterViewInit {
  readonly DEBUG_FREEZE = false;
  readonly workCenters: WorkCenterDocument[];
  readonly workOrders: WorkOrderDocument[];

  readonly hourColWidthPx = 96;
  readonly dayColWidthPx = 76;
  readonly weekColWidthPx = 168;
  readonly monthColWidthPx = 82;
  readonly timescaleOptions: Timescale[] = ['hour', 'day', 'week', 'month'];
  readonly statusOptions: WorkOrderStatus[] = ['open', 'in-progress', 'complete', 'blocked'];

  private readonly msPerDay = 1000 * 60 * 60 * 24;
  private readonly dayTopFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
  private readonly dayBottomFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  private readonly hourTopFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: 'UTC' });
  private readonly hourBottomFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  private readonly weekFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  private readonly monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  private workOrdersByWorkCenterId: Partial<Record<string, WorkOrderDocument[]>> = {};

  timescale: Timescale = 'month';
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
  timescaleMenuOpen = false;

  @ViewChild('timelineScrollPanel') private readonly timelineScrollPanelRef?: ElementRef<HTMLElement>;

  startDateStructValue: NgbDateStruct | null = null;
  endDateStructValue: NgbDateStruct | null = null;
  dateRangeErrorText: string | null = null;
  overlapErrorText: string | null = null;

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
      this.workCenters = sampleWorkCenters.map((center) => ({ ...center, data: { ...center.data } }));
      this.workOrders = sampleWorkOrders.map((order) => ({ ...order, data: { ...order.data } }));
    }

    this.workOrderForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(80)]],
      status: ['open' as WorkOrderStatus, Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required]
    });

    this.workOrderForm.valueChanges.subscribe(() => {
      this.recomputeDerivedFormState();
    });

    this.rebuildWorkOrderGroups();
    this.rebuildColumns();
    this.recomputeDerivedFormState();
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      if (this.timescale === 'month') {
        const timelinePanel = this.timelineScrollPanelRef?.nativeElement;
        if (timelinePanel) {
          timelinePanel.scrollLeft = 0;
        }
        return;
      }
      this.scrollToToday(false);
    });
  }

  /** Returns active timeline column width in pixels based on selected timescale. */
  get colWidthPx(): number {
    if (this.timescale === 'hour') {
      return this.hourColWidthPx;
    }
    if (this.timescale === 'week') {
      return this.weekColWidthPx;
    }
    if (this.timescale === 'month') {
      return this.monthColWidthPx;
    }
    return this.dayColWidthPx;
  }

  /** Save button text based on current panel mode. */
  get panelPrimaryActionLabel(): string {
    return 'Create';
  }

  /** Side panel title shown in both create and edit mode. */
  get panelTitle(): string {
    return 'Work Order Details';
  }

  /** Label shown above the timeline indicator based on active timescale. */
  get currentIndicatorLabel(): string {
    if (this.timescale === 'month') {
      return 'Current month';
    }
    if (this.timescale === 'hour') {
      return 'Current hour';
    }
    if (this.timescale === 'week') {
      return 'Current week';
    }
    return 'Current day';
  }

  /** Save button state derived from form validity and custom validations. */
  get canSave(): boolean {
    return this.workOrderForm.valid && !this.dateRangeErrorText && !this.overlapErrorText;
  }

  /** Changes timeline timescale and rebuilds visible columns when needed. */
  setTimescale(next: Timescale): void {
    if (this.timescale === next) {
      this.timescaleMenuOpen = false;
      return;
    }
    this.timescale = next;
    this.timescaleMenuOpen = false;
    this.rebuildColumns();
    queueMicrotask(() => {
      const timelinePanel = this.timelineScrollPanelRef?.nativeElement;
      if (!timelinePanel) {
        return;
      }
      if (this.timescale === 'month') {
        timelinePanel.scrollLeft = 0;
        return;
      }
      this.scrollToToday(false);
    });
  }

  /** Returns human-readable label for timescale menu and trigger. */
  timescaleLabel(timescale: Timescale): string {
    return timescale.charAt(0).toUpperCase() + timescale.slice(1);
  }

  /** Toggles custom timescale menu. */
  onTimescaleMenuToggle(event: MouseEvent): void {
    event.stopPropagation();
    this.timescaleMenuOpen = !this.timescaleMenuOpen;
  }

  /** TrackBy function for timeline columns to avoid unnecessary re-renders. */
  trackByCol(_: number, col: TimelineColumn): string {
    return col.key;
  }

  /** Pixel offset of current local time within the UTC-based timeline axis. */
  get todayOffsetPx(): number {
    if (this.timescale === 'hour') {
      return this.snapPx(this.utcDayToPx(this.isoToUtcDay(REFERENCE_ANCHOR_ISO) + 0.5));
    }
    return this.snapPx(this.utcDayToPx(this.isoToUtcDay(REFERENCE_ANCHOR_ISO)));
  }

  /** Left pixel offset for a work-order bar from its start date. */
  barLeftPx(workOrder: WorkOrderDocument): number {
    const orderStartDay = this.isoToUtcDay(workOrder.data.startDate);
    return this.snapPx(this.utcDayToPx(orderStartDay));
  }

  /** Width of a work-order bar in pixels including the end day. */
  barWidthPx(workOrder: WorkOrderDocument): number {
    const startUtcDay = this.isoToUtcDay(workOrder.data.startDate);
    const endExclusiveUtcDay = this.isoToUtcDay(workOrder.data.endDate) + 1;
    const startPx = this.snapPx(this.utcDayToPx(startUtcDay));
    const endPx = this.snapPx(this.utcDayToPx(endExclusiveUtcDay));
    const rangeWidthPx = Math.max(1, endPx - startPx);
    return Math.max(rangeWidthPx, this.minBarWidthPx(workOrder));
  }

  /** Ensures short-duration bars still leave room for label and status pill. */
  private minBarWidthPx(workOrder: WorkOrderDocument): number {
    const statusWidthByType: Record<WorkOrderStatus, number> = {
      open: 66,
      'in-progress': 96,
      complete: 84,
      blocked: 80
    };
    const nameWidth = Math.min(320, 20 + workOrder.data.name.length * 6.4);
    const statusWidth = statusWidthByType[workOrder.data.status] ?? 80;
    const kebabReserve = 22;
    const outerPadding = 22;
    return this.snapPx(nameWidth + statusWidth + kebabReserve + outerPadding);
  }

  /** Returns work orders for one center, filtered to visible timeline range. */
  visibleWorkOrdersForCenter(workCenterId: string): WorkOrderDocument[] {
    const grouped = this.workOrdersByWorkCenterId[workCenterId] ?? [];
    if (this.visibleColumns.length === 0) {
      return grouped;
    }
    const rangeStartUtcDay = this.visibleColumns[0].startUtcDay;
    const rangeEndUtcDay = this.visibleColumns[this.visibleColumns.length - 1].endUtcDay - 1;
    return grouped.filter((workOrder) => {
      const orderStartUtcDay = this.isoToUtcDay(workOrder.data.startDate);
      const orderEndUtcDay = this.isoToUtcDay(workOrder.data.endDate);
      return orderEndUtcDay >= rangeStartUtcDay && orderStartUtcDay <= rangeEndUtcDay;
    });
  }

  /** User-facing status label shown in ng-select and status badges. */
  statusLabel(status: WorkOrderStatus): string {
    if (status === 'in-progress') {
      return 'In progress';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  /** Work center display name used by template. */
  workCenterName(workCenter: WorkCenterDocument): string {
    return workCenter.data.name;
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
    this.openCreatePanel(workCenterId, this.utcDayToIso(utcDay));
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

    const workOrder = this.workOrders.find((order) => order.docId === workOrderId);
    if (!workOrder) {
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
      workCenterId: workOrder.data.workCenterId,
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
    const workOrder = this.workOrders.find((order) => order.docId === id);
    if (!workOrder) {
      return;
    }
    this.openEditPanel(workOrder);
  }

  /** Deletes selected work order from actions menu. */
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

  /** Scrolls timeline so today is close to center of viewport. */
  scrollToToday(smooth = true): void {
    const timelinePanel = this.timelineScrollPanelRef?.nativeElement;
    if (!timelinePanel) {
      return;
    }
    const maxScrollLeft = Math.max(0, timelinePanel.scrollWidth - timelinePanel.clientWidth);
    const target = this.snapPx(this.todayOffsetPx - timelinePanel.clientWidth / 2);
    timelinePanel.scrollTo({
      left: Math.min(maxScrollLeft, Math.max(0, target)),
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  /** Shows row hover hint unless pointer is over interactive content. */
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

  /** Clears row hover hint when leaving row. */
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
    this.workOrderForm.controls.startDate.setValue(startIso);
    this.workOrderForm.controls.startDate.markAsTouched();

    if (!selectedStart || !this.endDateStructValue) {
      return;
    }
    if (this.structToDate(selectedStart).getTime() <= this.structToDate(this.endDateStructValue).getTime()) {
      return;
    }
    this.endDateStructValue = this.cloneDateStruct(selectedStart);
    this.workOrderForm.controls.endDate.setValue(startIso);
    this.workOrderForm.controls.endDate.markAsTouched();
  }

  /** Syncs end datepicker selection into form ISO field. */
  onEndDatePicked(date: NgbDateStruct | null): void {
    const selectedEnd = date ? this.cloneDateStruct(date) : null;
    this.endDateStructValue = selectedEnd;

    if (!selectedEnd) {
      this.workOrderForm.controls.endDate.setValue('');
      this.workOrderForm.controls.endDate.markAsTouched();
      return;
    }

    const selectedStart = this.startDateStructValue;
    if (selectedStart && this.structToDate(selectedEnd).getTime() < this.structToDate(selectedStart).getTime()) {
      this.endDateStructValue = this.cloneDateStruct(selectedStart);
      this.workOrderForm.controls.endDate.setValue(this.structToIsoDateOnly(selectedStart));
      this.workOrderForm.controls.endDate.markAsTouched();
      return;
    }

    this.workOrderForm.controls.endDate.setValue(this.structToIsoDateOnly(selectedEnd));
    this.workOrderForm.controls.endDate.markAsTouched();
  }

  /** Handles Escape key for dismissing overlays. */
  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.timescaleMenuOpen) {
      this.timescaleMenuOpen = false;
      return;
    }
    if (this.actionsMenu) {
      this.closeActionsMenu();
      return;
    }
    if (this.panelOpen) {
      this.closePanel();
    }
  }

  /** Closes menus when clicking outside of controls. */
  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    const target = event.target as Element | null;

    if (!target?.closest('.timescale-btn') && !target?.closest('.timescale-menu')) {
      this.timescaleMenuOpen = false;
    }

    if (this.isInsideNgSelect(event)) {
      return;
    }
    if (!this.actionsMenu) {
      return;
    }
    if (target?.closest('.floating-actions-menu') || target?.closest('.work-order-kebab')) {
      return;
    }
    this.closeActionsMenu();
  }

  /** Resets and closes create/edit panel. */
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
      startDate: '',
      endDate: ''
    });
    this.recomputeDerivedFormState();
    this.workOrderForm.markAsPristine();
    this.workOrderForm.markAsUntouched();
  }

  /** Creates or updates work order based on panel mode. */
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
      startDate: raw.startDate ?? '',
      endDate: raw.endDate ?? ''
    };

    if (!payload.name) {
      this.saveError = 'Name is required.';
      return;
    }

    if (this.panelMode === 'edit' && this.editingWorkOrderId) {
      const index = this.workOrders.findIndex((item) => item.docId === this.editingWorkOrderId);
      if (index < 0) {
        this.saveError = 'Work order not found.';
        return;
      }
      this.workOrders[index] = {
        ...this.workOrders[index],
        data: {
          ...this.workOrders[index].data,
          ...payload
        }
      };
    } else {
      this.workOrders.push({
        docId: this.nextWorkOrderId(),
        docType: 'workOrder',
        data: payload
      });
    }

    this.rebuildWorkOrderGroups();
    this.closePanel();
  }

  /** Deletes current edit target from side panel. */
  deleteWorkOrder(): void {
    if (!this.editingWorkOrderId) {
      return;
    }
    this.deleteWorkOrderById(this.editingWorkOrderId);
  }

  /** Removes a work order by id and refreshes grouped data. */
  deleteWorkOrderById(workOrderId: string): void {
    const index = this.workOrders.findIndex((item) => item.docId === workOrderId);
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

  /** Opens panel in create mode with default 7-day range. */
  private openCreatePanel(workCenterId: string, startDateIso: string): void {
    this.panelMode = 'create';
    this.panelOpen = true;
    this.timescaleMenuOpen = false;
    this.editingWorkOrderId = null;
    this.panelWorkCenterId = workCenterId;
    this.panelWorkCenterName = this.findWorkCenterName(workCenterId);
    this.saveError = null;

    this.workOrderForm.reset({
      name: '',
      status: 'open',
      startDate: startDateIso,
      endDate: this.addDaysToIso(startDateIso, 7)
    });
    this.recomputeDerivedFormState();
  }

  /** Opens panel in edit mode and hydrates form from existing work order. */
  private openEditPanel(workOrder: WorkOrderDocument): void {
    this.panelMode = 'edit';
    this.panelOpen = true;
    this.timescaleMenuOpen = false;
    this.editingWorkOrderId = workOrder.docId;
    this.panelWorkCenterId = workOrder.data.workCenterId;
    this.panelWorkCenterName = this.findWorkCenterName(workOrder.data.workCenterId);
    this.saveError = null;

    this.workOrderForm.reset({
      name: workOrder.data.name,
      status: workOrder.data.status,
      startDate: workOrder.data.startDate,
      endDate: workOrder.data.endDate
    });
    this.recomputeDerivedFormState();
  }

  /** Rebuilds lookup map of work orders grouped by work center id. */
  private rebuildWorkOrderGroups(): void {
    const grouped: Record<string, WorkOrderDocument[]> = {};

    for (const workOrder of this.workOrders) {
      const workCenterId = workOrder.data.workCenterId;
      const existing = grouped[workCenterId] ?? [];
      existing.push(workOrder);
      grouped[workCenterId] = existing;
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => this.isoToUtcDay(a.data.startDate) - this.isoToUtcDay(b.data.startDate));
    }

    this.workOrdersByWorkCenterId = grouped;
    this.recomputeDerivedFormState();
  }

  /** Recomputes timeline columns for current timescale. */
  private rebuildColumns(): void {
    const anchorUtcDay = this.isoToUtcDay(REFERENCE_ANCHOR_ISO);

    if (this.timescale === 'hour') {
      this.visibleColumns = this.buildHourColumns(anchorUtcDay + 0.5);
      return;
    }
    if (this.timescale === 'week') {
      this.visibleColumns = this.buildWeekColumns(anchorUtcDay);
      return;
    }
    if (this.timescale === 'month') {
      this.visibleColumns = this.buildReferenceMonthColumns(anchorUtcDay);
      return;
    }
    this.visibleColumns = this.buildDayColumns(anchorUtcDay);
  }

  /** Builds +/-72 hour columns around the frozen reference hour. */
  private buildHourColumns(referenceUtcDayFloat: number): TimelineColumn[] {
    const columns: TimelineColumn[] = [];
    const currentHourStartUtcDay = Math.floor(referenceUtcDayFloat * 24) / 24;

    for (let offset = -72; offset <= 72; offset += 1) {
      const startUtcDay = currentHourStartUtcDay + offset / 24;
      const endUtcDay = startUtcDay + 1 / 24;
      columns.push({
        key: `h-${startUtcDay}`,
        startUtcDay,
        endUtcDay,
        topLabel: this.hourTopFormatter.format(this.utcDayToDate(startUtcDay)),
        bottomLabel: this.hourBottomFormatter.format(this.utcDayToDate(startUtcDay)),
        containsToday: startUtcDay <= referenceUtcDayFloat && referenceUtcDayFloat < endUtcDay
      });
    }

    return columns;
  }

  /** Builds +/-14 day columns around today. */
  private buildDayColumns(todayUtcDay: number): TimelineColumn[] {
    const columns: TimelineColumn[] = [];

    for (let offset = -14; offset <= 14; offset += 1) {
      const startUtcDay = todayUtcDay + offset;
      const endUtcDay = startUtcDay + 1;
      columns.push({
        key: `d-${startUtcDay}`,
        startUtcDay,
        endUtcDay,
        topLabel: this.dayTopFormatter.format(this.utcDayToDate(startUtcDay)),
        bottomLabel: this.dayBottomFormatter.format(this.utcDayToDate(startUtcDay)),
        containsToday: startUtcDay <= todayUtcDay && todayUtcDay < endUtcDay
      });
    }

    return columns;
  }

  /** Builds +/-8 week columns around current week. */
  private buildWeekColumns(todayUtcDay: number): TimelineColumn[] {
    const columns: TimelineColumn[] = [];
    const currentWeekStartUtcDay = this.startOfWeekUtcDay(todayUtcDay);

    for (let offset = -8; offset <= 8; offset += 1) {
      const startUtcDay = currentWeekStartUtcDay + offset * 7;
      const endUtcDay = startUtcDay + 7;
      const endInclusive = endUtcDay - 1;
      columns.push({
        key: `w-${startUtcDay}`,
        startUtcDay,
        endUtcDay,
        topLabel: this.weekFormatter.format(this.utcDayToDate(startUtcDay)),
        bottomLabel: this.weekFormatter.format(this.utcDayToDate(endInclusive)),
        containsToday: startUtcDay <= todayUtcDay && todayUtcDay < endUtcDay
      });
    }

    return columns;
  }

  /** Builds fixed Aug 2024 -> Mar 2025 month columns to match reference capture. */
  private buildReferenceMonthColumns(todayUtcDay: number): TimelineColumn[] {
    const baseYear = 2024;
    const baseMonth = 7;
    const columns: TimelineColumn[] = [];

    for (let offset = 0; offset <= 7; offset += 1) {
      const startUtcDay = Date.UTC(baseYear, baseMonth + offset, 1) / this.msPerDay;
      const endUtcDay = Date.UTC(baseYear, baseMonth + offset + 1, 1) / this.msPerDay;
      columns.push({
        key: `m-${startUtcDay}`,
        startUtcDay,
        endUtcDay,
        topLabel: this.monthFormatter.format(this.utcDayToDate(startUtcDay)),
        bottomLabel: '',
        containsToday: startUtcDay <= todayUtcDay && todayUtcDay < endUtcDay
      });
    }

    return columns;
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
      (column) => utcDay >= column.startUtcDay && utcDay < column.endUtcDay
    );
    if (colIndex < 0) {
      return 0;
    }

    const column = this.visibleColumns[colIndex];
    const fractionWithinColumn = (utcDay - column.startUtcDay) / (column.endUtcDay - column.startUtcDay);
    return (colIndex + fractionWithinColumn) * this.colWidthPx;
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
    const column = this.visibleColumns[colIndex];
    const colStartPx = colIndex * this.colWidthPx;
    const fractionWithinColumn = (px - colStartPx) / this.colWidthPx;
    return column.startUtcDay + fractionWithinColumn * (column.endUtcDay - column.startUtcDay);
  }

  /** Snaps coordinates to physical pixels to keep edges crisp across display DPIs. */
  private snapPx(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const dpr = globalThis.devicePixelRatio || 1;
    return Math.round(value * dpr) / dpr;
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

  /** Converts UTC day number to UTC date object. */
  private utcDayToDate(utcDay: number): Date {
    return new Date(utcDay * this.msPerDay);
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

  /** Converts local calendar date to UTC day index. */
  private toUtcDay(d: Date): number {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / this.msPerDay;
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
    this.hoverHintLeftPx = Math.min(Math.max(event.clientX - rect.left, 0), rowWidth);
  }

  /** Checks whether pointer is inside row interactive controls. */
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

  /** Closes floating actions menu. */
  private closeActionsMenu(): void {
    this.actionsMenu = null;
  }

  /** Checks if click target is inside ng-select input or dropdown panel. */
  private isInsideNgSelect(event: Event): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    return Boolean(target.closest('ng-select') || target.closest('.ng-select') || target.closest('.ng-dropdown-panel'));
  }

  /** Recomputes datepicker models and validation errors from form values. */
  private recomputeDerivedFormState(): void {
    const startDate = this.workOrderForm.controls.startDate.value ?? '';
    const endDate = this.workOrderForm.controls.endDate.value ?? '';

    this.startDateStructValue = this.isoToDateStruct(startDate);
    this.endDateStructValue = this.isoToDateStruct(endDate);
    this.dateRangeErrorText = this.computeDateRangeErrorText(startDate, endDate);
    this.overlapErrorText = this.computeOverlapErrorText(startDate, endDate);
  }

  /** Validates start/end date ordering for current form values. */
  private computeDateRangeErrorText(startDateIso: string, endDateIso: string): string | null {
    if (!startDateIso || !endDateIso) {
      return null;
    }

    if (this.isoToUtcDay(endDateIso) < this.isoToUtcDay(startDateIso)) {
      return 'End date must be on or after start date.';
    }
    return null;
  }

  /** Validates overlap conflicts for selected work center. */
  private computeOverlapErrorText(startDateIso: string, endDateIso: string): string | null {
    if (!this.panelWorkCenterId || !startDateIso || !endDateIso || this.dateRangeErrorText) {
      return null;
    }

    const startUtcDay = this.isoToUtcDay(startDateIso);
    const endUtcDay = this.isoToUtcDay(endDateIso);
    const overlap = this.findOverlap(this.panelWorkCenterId, startUtcDay, endUtcDay, this.editingWorkOrderId);
    if (!overlap) {
      return null;
    }

    return `Overlaps with "${overlap.data.name}" (${overlap.data.startDate} to ${overlap.data.endDate}).`;
  }

  /** Finds first overlapping work order for same center, excluding optional id. */
  private findOverlap(
    workCenterId: string,
    startUtcDay: number,
    endUtcDay: number,
    skipWorkOrderId: string | null
  ): WorkOrderDocument | null {
    const centerWorkOrders = this.workOrdersByWorkCenterId[workCenterId] ?? [];
    for (const existing of centerWorkOrders) {
      if (skipWorkOrderId && existing.docId === skipWorkOrderId) {
        continue;
      }

      const existingStart = this.isoToUtcDay(existing.data.startDate);
      const existingEnd = this.isoToUtcDay(existing.data.endDate);
      const overlaps = !(endUtcDay < existingStart || startUtcDay > existingEnd);
      if (overlaps) {
        return existing;
      }
    }
    return null;
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
    return this.workCenters.find((center) => center.docId === workCenterId)?.data.name ?? workCenterId;
  }

  /** Generates next numeric work-order id in `wo-0000` format. */
  private nextWorkOrderId(): string {
    let maxId = 0;

    for (const workOrder of this.workOrders) {
      const parsed = Number(workOrder.docId.replace(/^wo-/, ''));
      if (Number.isFinite(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    }

    return `wo-${String(maxId + 1).padStart(4, '0')}`;
  }
}
