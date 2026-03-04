import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { workCenters, workOrders } from '../data/sample-documents';
import { WorkOrderDocument } from '../types/docs';

type Timescale = 'day' | 'week' | 'month';

type TimelineColumn = {
  key: string;
  startUtcDay: number;
  endUtcDay: number;
  topLabel: string;
  bottomLabel: string;
  containsToday: boolean;
};

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  readonly workCenters = workCenters;
  readonly workOrders = workOrders;

  readonly dayColWidthPx = 84;
  readonly weekColWidthPx = 168;
  readonly monthColWidthPx = 224;
  readonly timescaleOptions: Timescale[] = ['day', 'week', 'month'];
  private readonly msPerDay = 1000 * 60 * 60 * 24;
  private readonly dayTopFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
  private readonly dayBottomFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  private readonly weekTopFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  private readonly monthTopFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  private readonly monthBottomFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });

  timescale: Timescale = 'day';
  visibleColumns: TimelineColumn[] = [];
  readonly workOrdersByWorkCenterId = this.groupWorkOrdersByWorkCenterId();

  constructor() {
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

  private groupWorkOrdersByWorkCenterId(): Partial<Record<string, WorkOrderDocument[]>> {
    const grouped: Record<string, WorkOrderDocument[]> = {};
    for (const workOrder of this.workOrders) {
      const existing = grouped[workOrder.workCenterId] ?? [];
      existing.push(workOrder);
      grouped[workOrder.workCenterId] = existing;
    }
    return grouped;
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

  private toUtcDay(d: Date): number {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / this.msPerDay;
  }
}
