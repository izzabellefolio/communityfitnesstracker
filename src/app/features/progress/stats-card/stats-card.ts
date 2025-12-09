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

  @Input() color: 'primary' | 'success' | 'danger' | 'warning' | 'info' = 'primary';
  @Input() trend: 'up' | 'down' | 'neutral' = 'neutral';
  @Input() trendValue = 0;
  @Input() isLoading = false;
  @Input() unit = '';

  getIconColor(): string {
    const colors: { [key: string]: string } = {
      primary: '#6366f1',
      success: '#20c997',
      danger: '#dc3545',
      warning: '#ffc107',
      info: '#0dcaf0'
    };
    return colors[this.color] || colors['primary'];
  }

  getTrendIcon(): string {
    switch (this.trend) {
      case 'up': return 'bi-arrow-up-circle-fill text-success';
      case 'down': return 'bi-arrow-down-circle-fill text-danger';
      default: return 'bi-dash-circle-fill text-secondary';
    }
  }

  getTrendText(): string {
    switch (this.trend) {
      case 'up':
        return `+${this.trendValue}% from last week`;
      case 'down':
        return `-${this.trendValue}% from last week`;
      default:
        return 'No change from last week';
    }
  }

  // helper to detect if the `icon` input is a CSS class (Bootstrap Icons) or an emoji/text
  isIconClass(): boolean {
    return typeof this.icon === 'string' && this.icon.startsWith('bi-');
  }
}
