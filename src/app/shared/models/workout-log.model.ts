import { Exercise } from './exercise.model';

export interface WorkoutLogModel {
  id?: string;
  userId: string;
  routineId: string;
  routineName: string;
  date: Date;
  exercises: Exercise[];
  totalReps: number;
  caloriesBurned: number;
  duration: number; // in minutes
  notes?: string;
  completed: boolean;
  weight?: number;
}

export interface WorkoutLog {
  id?: string;
  userId: string;
  date: Date;
  totalCalories: number;
  totalDuration: number;
  exercises: any[];
  intensityScore?: number;
}


export interface UserStats {
  streak: number;
  totalWorkouts: number;
  totalReps: number;
  caloriesBurned: number;
  currentWeight?: number;
  lastWorkoutDate?: Date;
}

export interface UserMetrics {
  id?: string;
  userId: string;
  weight: number;
  height: number;
  metabolism: 'slow' | 'medium' | 'fast';
  gender: 'male' | 'female' | 'other';
  bmi?: number;
  lastUpdated?: Date;
}
