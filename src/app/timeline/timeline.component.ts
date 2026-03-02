import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { workCenters, workOrders } from '../data/sample-documents';
import { WorkOrderDocument } from '../types/docs';

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

  // Phase 2: Day view range centered on today (±2 weeks)
  readonly dayColWidthPx = 84;
  readonly dayRangeBefore = 14;
  readonly dayRangeAfter = 14;
  private readonly msPerDay = 1000 * 60 * 60 * 24;

  readonly today = this.startOfDay(new Date());
  readonly rangeStart = this.addDays(this.today, -this.dayRangeBefore);
  readonly rangeEnd = this.addDays(this.today, this.dayRangeAfter);
  private readonly rangeStartDay = this.toUtcDay(this.rangeStart);

  readonly visibleDates: Date[] = this.buildVisibleDates();
  readonly workOrdersByWorkCenterId = this.groupWorkOrdersByWorkCenterId();

  private buildVisibleDates(): Date[] {
    const dates: Date[] = [];
    let cur = new Date(this.rangeStart);
    while (cur <= this.rangeEnd) {
      dates.push(new Date(cur));
      cur = this.addDays(cur, 1);
    }
    return dates;
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private addDays(d: Date, days: number): Date {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  isToday(d: Date): boolean {
    return (
      d.getFullYear() === this.today.getFullYear() &&
      d.getMonth() === this.today.getMonth() &&
      d.getDate() === this.today.getDate()
    );
  }

  get todayOffsetPx(): number {
    const daysFromStart = Math.round((this.today.getTime() - this.rangeStart.getTime()) / this.msPerDay);
    return daysFromStart * this.dayColWidthPx;
  }

  trackByIso(_: number, d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  barLeftPx(workOrder: WorkOrderDocument): number {
    const orderStartDay = this.isoToUtcDay(workOrder.startsAtIso);
    return (orderStartDay - this.rangeStartDay) * this.dayColWidthPx;
  }

  // End dates are treated as inclusive, so we add one full day when calculating pixel width.
  barWidthPx(workOrder: WorkOrderDocument): number {
    const orderStartDay = this.isoToUtcDay(workOrder.startsAtIso);
    const orderEndDay = this.isoToUtcDay(workOrder.endsAtIso);
    const daySpan = orderEndDay - orderStartDay + 1;
    return daySpan * this.dayColWidthPx;
  }

  private groupWorkOrdersByWorkCenterId(): Record<string, WorkOrderDocument[]> {
    const grouped: Record<string, WorkOrderDocument[]> = {};
    for (const workOrder of this.workOrders) {
      const existing = grouped[workOrder.workCenterId] ?? [];
      existing.push(workOrder);
      grouped[workOrder.workCenterId] = existing;
    }
    return grouped;
  }

  private isoToUtcDay(isoDate: string): number {
    const [year, month, day] = isoDate.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / this.msPerDay;
  }

  private toUtcDay(d: Date): number {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / this.msPerDay;
  }
}
