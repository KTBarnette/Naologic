import { Component } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TimelineComponent],
  template: '<app-timeline></app-timeline>'
})
export class AppComponent {}
