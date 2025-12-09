export interface Exercise {
  id?: string;
  name: string;
  type: 'cardio' | 'strength' | 'flexibility' | 'balance';
  sets: number;
  reps: number;
  duration: number; // in minutes
  intensity: number; // 1-10
  caloriesPerMinute: number;
  isCustom?: boolean; // optional flag for user-added exercises
  isTemplate?: boolean; // optional flag if needed
  met?: number;  // Metabolic Equivalent of Task value
}