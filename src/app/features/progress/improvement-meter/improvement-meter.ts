import { Component, Input } from '@angular/core';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-improvement-meter',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './improvement-meter.html',
  styleUrls: ['./improvement-meter.css']
})
export class ImprovementMeterComponent {
  @Input() status: 'improving' | 'maintaining' | 'regressing' = 'maintaining';
  @Input() value = 75;

  getStatusColor(): string {
    const colors = {
      improving: '#20c997',
      maintaining: '#ffc107',
      regressing: '#dc3545'
    };
    return colors[this.status];
  }

  getStatusIcon(): string {
    const icons = {
      improving: 'bi-arrow-up-circle',
      maintaining: 'bi-dash-circle',
      regressing: 'bi-arrow-down-circle'
    };
    return icons[this.status];
  }

  getStatusMessage(): string {
    const messages = {
      improving: 'Great progress! Keep it up!',
      maintaining: 'Steady progress. Push a bit harder!',
      regressing: 'Time to refocus. You can do it!'
    };
    return messages[this.status];
  }

  getRotation(): number {
    // Convert value (0-100) to rotation (0-180 degrees)
    return (this.value / 100) * 180;
  }
}