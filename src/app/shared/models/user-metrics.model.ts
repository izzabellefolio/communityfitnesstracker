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

export interface DailyProgress {
  id?: string;
  userId: string;
  date: Date;
  caloriesBurned?: number;
  workoutsCompleted?: number;
  steps?: number;
  mood?: string;
}