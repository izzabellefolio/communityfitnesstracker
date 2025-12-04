export interface Exercise {
  name: string;
  type: string; // 'Strength', 'Cardio', 'Flexibility', 'Balance'
  sets: number;
  reps: number;
  duration: number; // in minutes
  intensity: 'Low' | 'Medium' | 'High';
  caloriesPerRep?: number;
  isCustom?: boolean; // indicates if the exercise is user-created
}