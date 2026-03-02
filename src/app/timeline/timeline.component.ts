import { Component } from '@angular/core';

@Component({
  selector: 'app-timeline',
  standalone: true,
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss'
})
export class TimelineComponent {
  readonly workCenters = [
    'Work Center 01',
    'Work Center 02',
    'Work Center 03',
    'Work Center 04',
    'Work Center 05'
  ];

  readonly timelineHeaders = [
    'Slot 01',
    'Slot 02',
    'Slot 03',
    'Slot 04',
    'Slot 05',
    'Slot 06',
    'Slot 07',
    'Slot 08',
    'Slot 09',
    'Slot 10',
    'Slot 11',
    'Slot 12'
  ];
}
