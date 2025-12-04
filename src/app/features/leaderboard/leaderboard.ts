import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, query, where, orderBy, doc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, map, combineLatest } from 'rxjs';
import { LeaderboardEntry } from '../../shared/models/leaderboard-entry.model';
import { Routine } from '../../shared/models';

@Injectable({
  providedIn: 'root',
})
export class Leaderboard {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private userChallengesCollection = collection(this.firestore, 'userChallenges');
  private routinesCollection = collection(this.firestore, 'routines');
  private usersCollection = collection(this.firestore, 'users');

  // Get leaderboard entries
  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return from(this.calculateLeaderboard());
  }

  // Calculate leaderboard from user data
  private async calculateLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      // Get all completed challenges
      const challengesQuery = query(
        this.userChallengesCollection,
        where('status', '==', 'completed')
      );
      const challengesSnapshot = await getDocs(challengesQuery);

      // Get all routines for streak calculation
      const routinesSnapshot = await getDocs(this.routinesCollection);

      // Group challenges and routines by user
      const userStatsMap = new Map<string, {
        totalPoints: number,
        completedChallenges: number,
        completedDates: Set<string>,
      }>();

      // Process challenges
      challengesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const userId = data['userId'];
        const points = data['points'] || 0;
        const date = data['date'] || '';

         if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            totalPoints: 0,
            completedChallenges: 0,
            completedDates: new Set<string>()
          });
        }

      const userStats = userStatsMap.get(userId)!;
        userStats.totalPoints += points;
        userStats.completedChallenges++;
        
        // Store the completion date if available
        if (date) {
          userStats.completedDates.add(date);
        } else {
          // Fallback: extract date from completedAt timestamp
          const completedAt = data['completedAt']?.toDate?.() || new Date();
          const dateKey = completedAt.toISOString().split('T')[0];
          userStats.completedDates.add(dateKey);
        }
      });

      // Create leaderboard entries
      const entries: LeaderboardEntry[] = [];

      for (const [userId, userStats] of userStatsMap.entries()) {
        // Calculate streak from completion dates
        const currentStreak = this.calculateStreakFromDates(Array.from(userStats.completedDates));
        
        // Get user info
        const userInfo = await this.getUserInfo(userId);
        
        entries.push({
          userId,
          displayName: userInfo.displayName,
          email: userInfo.email,
          totalPoints: userStats.totalPoints,
          completedChallenges: userStats.completedChallenges,
          currentStreak,
          lastUpdated: new Date()
        });
      }
      
      // Sort by total points (descending), then by streak
      entries.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        return b.currentStreak - a.currentStreak;
      });

      // Assign ranks
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;

    } catch (error) {
      console.error('Error calculating leaderboard:', error);
      return [];
    }
  }

  // Calculate streak from array of date strings (YYYY-MM-DD format)
  private calculateStreakFromDates(completedDates: string[]): number {
    if (completedDates.length === 0) return 0;
    
    // Sort dates descending (most recent first)
    const sortedDates = [...completedDates].sort().reverse();
    
    let streak = 0;
    const today = new Date();
    const todayKey = today.toISOString().split('T')[0];
    
    // Check if today has a completion
    if (sortedDates.includes(todayKey)) {
      streak = 1;
      
      // Check consecutive previous days
      for (let i = 1; i < sortedDates.length; i++) {
        const previousDate = new Date(today);
        previousDate.setDate(previousDate.getDate() - i);
        const previousDateKey = previousDate.toISOString().split('T')[0];
        
        if (sortedDates.includes(previousDateKey)) {
          streak++;
        } else {
          break;
        }
      }
    } else {
      // If no completion today, check yesterday and backwards
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().split('T')[0];
      
      if (sortedDates.includes(yesterdayKey)) {
        streak = 1;
        
        // Check consecutive previous days
        for (let i = 2; i < sortedDates.length + 1; i++) {
          const previousDate = new Date(today);
          previousDate.setDate(previousDate.getDate() - i);
          const previousDateKey = previousDate.toISOString().split('T')[0];
          
          if (sortedDates.includes(previousDateKey)) {
            streak++;
          } else {
            break;
          }
        }
      }
    }
    
    return streak;
  }

  // Get user info from users collection
  private async getUserInfo(userId: string): Promise<{ displayName: string; email: string }> {
    try {
      const userQuery = query(
        collection(this.firestore, 'users'),
        where('__name__', '==', userId)
      );
      
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        return {
          displayName: userData['displayName'] || 
                      userData['name'] || 
                      userData['email']?.split('@')[0] || 
                      `User${userId.substring(0, 6)}`,
          email: userData['email'] || `user${userId.substring(0, 6)}@fitness.com`
        };
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
    
    // Return default info if user not found
    return {
      displayName: `User${userId.substring(0, 6)}`,
      email: `user${userId.substring(0, 6)}@fitness.com`
    };
  }

  // Get current user's rank
  getCurrentUserRank(): Observable<number | null> {
    return new Observable(subscriber => {
      const currentUserId = this.auth.currentUser?.uid;
      
      if (!currentUserId) {
        subscriber.next(null);
        subscriber.complete();
        return;
      }

      this.getLeaderboard().subscribe({
        next: (entries) => {
          const userEntry = entries.find(e => e.userId === currentUserId);
          subscriber.next(userEntry?.rank || null);
          subscriber.complete();
        },
        error: (error) => {
          console.error('Error getting user rank:', error);
          subscriber.next(null);
          subscriber.complete();
        }
      });
    });
  }

  // Get top N users
  getTopUsers(count: number): Observable<LeaderboardEntry[]> {
    return this.getLeaderboard().pipe(
      map(entries => entries.slice(0, count))
    );
  }
}