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

export interface UserStats {
  streak: number;
  totalWorkouts: number;
  totalReps: number;
  caloriesBurned: number;
  currentWeight?: number;
  lastWorkoutDate?: Date;
}