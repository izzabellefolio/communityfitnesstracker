export interface Challenge {
  id?: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  category: 'cardio' | 'strength' | 'endurance' | 'flexibility';
  duration: number; // in minutes
  target: number; // reps, minutes, etc.
}

export interface UserChallenge {
  id?: string;
  userId: string;
  challengeId: string;
  assignedDate: Date;
  completed: boolean;
  completedDate?: Date;
  type?: 'daily' | 'weekly';
}