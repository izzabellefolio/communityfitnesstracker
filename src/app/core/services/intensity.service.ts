import { Injectable } from '@angular/core';
import { Exercise } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class IntensityService {
  calculateExerciseIntensity(exercise: Exercise): number {
    const baseIntensity = exercise.intensity;
    const durationFactor = Math.min(exercise.duration / 60, 1.5); // Cap at 1.5x for long durations
    const typeMultiplier = this.getTypeMultiplier(exercise.type);
    
    return Math.min(baseIntensity * durationFactor * typeMultiplier, 10);
  }

  private getTypeMultiplier(type: string): number {
    const multipliers = {
      'cardio': 1.2,
      'strength': 1.0,
      'flexibility': 0.7,
      'balance': 0.6
    };
    return multipliers[type as keyof typeof multipliers] || 1.0;
  }

  calculateWorkoutIntensity(exercises: Exercise[]): number {
    if (exercises.length === 0) return 0;
    
    const totalIntensity = exercises.reduce((sum, exercise) => {
      return sum + this.calculateExerciseIntensity(exercise);
    }, 0);
    
    return totalIntensity / exercises.length;
  }

  getIntensityLevel(score: number): string {
    if (score >= 8) return 'Very High';
    if (score >= 6) return 'High';
    if (score >= 4) return 'Moderate';
    if (score >= 2) return 'Low';
    return 'Very Low';
  }

  getIntensityColor(score: number): string {
    if (score >= 8) return '#dc3545'; // Red
    if (score >= 6) return '#fd7e14'; // Orange
    if (score >= 4) return '#ffc107'; // Yellow
    if (score >= 2) return '#20c997'; // Green
    return '#6c757d'; // Gray
  }
}