export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  totalPoints: number;
  completedChallenges: number;
  currentStreak: number;
  rank?: number;
  lastUpdated?: Date;
}