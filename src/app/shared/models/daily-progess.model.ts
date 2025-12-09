export interface DailyProgress {
  id?: string;
  userId: string;
  date: Date;
  caloriesBurned?: number;
  workoutsCompleted?: number;
  steps?: number;
  mood?: string;
}
