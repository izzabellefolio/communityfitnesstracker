import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-card.html',
  styleUrls: ['./stats-card.css'],
})
export class StatsCard {
  @Input() title = '';
  @Input() value: string | number = 0;
  @Input() subtitle = '';
  @Input() icon = '📊';
  @Input() gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}
