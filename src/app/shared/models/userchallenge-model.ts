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