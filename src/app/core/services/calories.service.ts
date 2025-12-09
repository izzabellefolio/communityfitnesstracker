import { Injectable } from '@angular/core';
import { Exercise } from '../../shared/models';

export type Gender = 'male' | 'female';
export type Metabolism = 'high' | 'medium' | 'low';

@Injectable({
  providedIn: 'root'
})
export class CaloriesService {

  calculateExerciseCalories(
    exercise: Exercise,
    weight: number,
    gender: Gender,
    metabolism: Metabolism
  ): number {
    const durationHours = exercise.duration / 60;

    // Use provided MET or default if missing
    const metValue = exercise.met ?? this.getDefaultMET(exercise.intensity);

    const intensityMultiplier = exercise.intensity / 5;
    let calories = metValue * weight * durationHours * intensityMultiplier;

    // Adjust for metabolism
    let metabolismMultiplier = 1;
    if (metabolism === 'high') metabolismMultiplier = 1.1;
    if (metabolism === 'low') metabolismMultiplier = 0.9;
    calories *= metabolismMultiplier;

    return Math.round(calories);
  }

  calculateTotalCalories(
    exercises: Exercise[],
    weight: number,
    gender: Gender,
    metabolism: Metabolism
  ): number {
    return exercises.reduce((total, ex) => {
      return total + this.calculateExerciseCalories(ex, weight, gender, metabolism);
    }, 0);
  }

  estimateDailyCalorieBurn(
    weight: number,
    height: number,
    age: number,
    gender: Gender,
    activityLevel: number
  ): number {
    let bmr: number;
    if (gender === 'male') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    return Math.round(bmr * activityLevel);
  }

  /** Private helper: returns a default MET based on intensity */
  private getDefaultMET(intensity: number): number {
    if (intensity <= 3) return 3;     // light activity
    if (intensity <= 6) return 5;     // moderate activity
    return 8;                          // high intensity
  }
}
