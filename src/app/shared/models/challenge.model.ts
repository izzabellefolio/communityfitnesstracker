// Add these properties to your ChallengeModel interface
export interface ChallengeModel {
  id?: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly'; 
  points: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: 'Strength' | 'Cardio' | 'Flexibility' | 'Nutrition' | 'Consistency';
  
  lastShown?: Date;     
  shownCount?: number;   
  isActive?: boolean;   
  dateAssigned?: Date; 
}

export interface UserChallenge {
  id?: string;
  userId: string;
  challengeId: string;
  challengeTitle: string;
  challengeType: 'daily' | 'weekly';
  points: number;
  completedAt: Date;
  status: 'completed' | 'in-progress' | 'failed';
}