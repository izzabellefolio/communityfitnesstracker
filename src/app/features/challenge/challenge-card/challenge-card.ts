import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChallengeModel } from '../../../shared/models/challenge.model';

@Component({
  selector: 'app-challenge-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './challenge-card.html',
  styleUrls: ['./challenge-card.css'],
})
export class ChallengeCard {
  @Input() challenge!: ChallengeModel;
  @Input() isCompleted = false;
  @Input() showCompleteButton = true;
  @Output() complete = new EventEmitter<ChallengeModel>();

  // Daily challenges only - simplified colors
  getDifficultyColor(): string {
    switch (this.challenge.difficulty) {
      case 'Easy': return 'success';
      case 'Medium': return 'warning';
      case 'Hard': return 'danger';
      default: return 'primary'; // Default to primary for daily
    }
  }

  getCategoryIcon(): string {
    switch (this.challenge.category) {
      case 'Strength': return '💪';
      case 'Cardio': return '🏃';
      case 'Flexibility': return '🧘';
      case 'Nutrition': return '🥗';
      case 'Consistency': return '🎯';
      default: return '⭐';
    }
  }

  onComplete() {
    console.log('Card: Completing daily challenge', this.challenge.title);
    this.complete.emit(this.challenge);
  }
}