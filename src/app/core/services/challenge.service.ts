import { Injectable, inject } from '@angular/core';
import {Firestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  doc,
  updateDoc
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { ChallengeModel, UserChallenge } from '../../shared/models/challenge.model';

@Injectable({
  providedIn: 'root',
})
export class ChallengeService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private challengesCollection = collection(this.firestore, 'challenges');
  private userChallengesCollection = collection(this.firestore, 'userChallenges');

  // -------------------------------------------------------
  // UTIL
  // -------------------------------------------------------

  private getWeekKey(date: Date): string {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    // Adjust to Monday of the current ISO week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0]; // e.g., '2025-12-08'
  }

  // -------------------------------------------------------
  // CHALLENGE QUERIES
  // -------------------------------------------------------

  private getDailyChallenges(): Observable<ChallengeModel[]> {
    const q = query(this.challengesCollection, where('type', '==', 'daily'));
    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ChallengeModel))
      )
    );
  }

  public getPublicDailyChallenges(): Observable<ChallengeModel[]> {
    return this.getDailyChallenges();
  }

  private getWeeklyChallenges(): Observable<ChallengeModel[]> {
    const q = query(this.challengesCollection, where('type', '==', 'weekly'));
    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ChallengeModel))
      )
    );
  }

  public getPublicWeeklyChallenges(): Observable<ChallengeModel[]> {
    return this.getWeeklyChallenges();
  }

  // -------------------------------------------------------
  // DAILY & WEEKLY CHALLENGE ASSIGNMENT
  // -------------------------------------------------------

  getDailyChallengeOfTheDay(): Observable<ChallengeModel | null> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(null);

    const todayStr = new Date().toISOString().split('T')[0];
    const userDocRef = doc(this.firestore, 'users', userId);

    return from(getDoc(userDocRef)).pipe(
      switchMap(userSnap => {
        const userData: any = userSnap.exists() ? userSnap.data() : {};
        const assignedId: string | undefined = userData?.['dailyChallengeId'];
        const assignedDate: string | undefined = userData?.['dailyChallengeDate'];

        // If user already has a daily assigned for today, return that challenge
        if (assignedId && assignedDate === todayStr) {
          const challengeDocRef = doc(this.firestore, 'challenges', assignedId);
          return from(getDoc(challengeDocRef)).pipe(
            map(chSnap => (chSnap.exists() ? ({ id: chSnap.id, ...(chSnap.data() as any) } as ChallengeModel) : null)),
            catchError(err => {
              console.error('[ChallengeService] Error fetching assigned daily challenge:', err);
              return of(null);
            })
          );
        }

        // Otherwise select a random daily challenge and assign it
        return this.getDailyChallenges().pipe(
          switchMap(challenges => {
            if (!challenges || challenges.length === 0) return of(null);
            const choice = challenges[Math.floor(Math.random() * challenges.length)];
            if (!choice?.id) return of(choice || null);
            return from(updateDoc(userDocRef, { dailyChallengeId: choice.id, dailyChallengeDate: todayStr })).pipe(
              map(() => choice),
              catchError(err => {
                console.error('[ChallengeService] Failed to assign daily challenge, returning chosen challenge anyway', err);
                return of(choice);
              })
            );
          })
        );
      }),
      catchError(err => {
        console.error('[ChallengeService] Fatal error in getDailyChallengeOfTheDay', err);
        return of(null);
      })
    );
  }

  getWeeklyChallengeOfTheWeek(): Observable<ChallengeModel | null> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(null);

    const weekKey = this.getWeekKey(new Date());
    const userDocRef = doc(this.firestore, 'users', userId);

    return from(getDoc(userDocRef)).pipe(
      switchMap(userSnap => {
        const userData: any = userSnap.exists() ? userSnap.data() : {};
        const weeklyChallengeId: string | undefined = userData?.['weeklyChallengeId'];
        const lastAssignedWeek: string | undefined = userData?.['weeklyChallengeWeek'];

        // If a weekly challenge was already assigned this week, return it
        if (weeklyChallengeId && lastAssignedWeek === weekKey) {
          const challengeDocRef = doc(this.firestore, 'challenges', weeklyChallengeId);
          return from(getDoc(challengeDocRef)).pipe(
            map(chSnap => (chSnap.exists() ? ({ id: chSnap.id, ...(chSnap.data() as any) } as ChallengeModel) : null)),
            catchError(err => {
              console.error('[ChallengeService] Error fetching assigned weekly challenge:', err);
              return of(null);
            })
          );
        }

        // Otherwise select a random weekly challenge and assign it
        return this.getWeeklyChallenges().pipe(
          switchMap(challenges => {
            if (!challenges || challenges.length === 0) return of(null);
            const choice = challenges[Math.floor(Math.random() * challenges.length)];
            if (!choice?.id) return of(choice || null);
            return from(updateDoc(userDocRef, { weeklyChallengeId: choice.id, weeklyChallengeWeek: weekKey })).pipe(
              map(() => choice),
              catchError(err => {
                console.error('[ChallengeService] Failed to assign weekly challenge, returning chosen challenge anyway', err);
                return of(choice);
              })
            );
          })
        );
      }),
      catchError(err => {
        console.error('Error in getWeeklyChallengeOfTheWeek:', err);
        return of(null);
      })
    );
  }

  // -------------------------------------------------------
  // COMPLETING CHALLENGES
  // -------------------------------------------------------

  completeChallenge(challenge: ChallengeModel): Observable<string> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    if (!challenge.id) {
      throw new Error('Cannot complete challenge: missing ID');
    }

    const userChallenge: UserChallenge = {
      userId,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      challengeType: challenge.type,
      points: challenge.points,
      completedAt: new Date(),
      status: 'completed'
    };

    return from(addDoc(this.userChallengesCollection, userChallenge)).pipe(
      map(docRef => docRef.id)
    );
  }

  // -------------------------------------------------------
  // USER CHALLENGE HISTORY & POINTS
  // -------------------------------------------------------

  getUserCompletedChallenges(): Observable<UserChallenge[]> {
  const userId = this.auth.currentUser?.uid;
  if (!userId) return of([]);

  // Avoid using orderBy in the Firestore query to prevent requiring a composite index.
  const q = query(
    this.userChallengesCollection,
    where('userId', '==', userId),
    where('status', '==', 'completed')
  );

  return from(getDocs(q)).pipe(
    map(snapshot =>
      snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data['userId'],
          challengeId: data['challengeId'],
          challengeTitle: data['challengeTitle'],
          challengeType: data['challengeType'],
          points: typeof data['points'] === 'number' ? data['points'] : Number(data['points']) || 0,
          // Keep Firestore Timestamp handling robust by converting if needed
          completedAt: data['completedAt']?.toDate?.() || new Date(data['completedAt']),
          status: data['status']
        } as UserChallenge;
      })
    ),
    // sort locally by completedAt desc so UI still shows newest first
    map((arr: UserChallenge[]) => arr.sort((a, b) => +new Date(b.completedAt).getTime() - +new Date(a.completedAt).getTime())),
    catchError(err => {
      console.error('[ChallengeService] getUserCompletedChallenges error', err);
      return of([] as UserChallenge[]);
    })
  );
}

  // Optional: Keep if used elsewhere
  hasCompletedChallenge(challengeId: string): Observable<boolean> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(false);

    const q = query(
      this.userChallengesCollection,
      where('userId', '==', userId),
      where('challengeId', '==', challengeId),
      where('status', '==', 'completed')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => !snapshot.empty)
    );
  }

  // You can keep this, but component should compute points locally for better UX
  getUserTotalPoints(): Observable<number> {
    return this.getUserCompletedChallenges().pipe(
      map(challenges => challenges.reduce((sum, c) => sum + c.points, 0))
    );
  }

  // helper: pick N distinct random items from an array
private pickRandom<T>(arr: T[], n: number): T[] {
  if (!arr || arr.length <= n) return [...arr];
  const out: T[] = [];
  const copy = [...arr];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * Returns 3 daily challenges for the current user, persistent for the day.
 * Persists `assignedDailyIds` and `assignedDailyDate` on users/{uid}.
 */
getDailyChallengesOfTheDay(): Observable<ChallengeModel[] | null> {
  const userId = this.auth.currentUser?.uid;
  if (!userId) return of(null);
  const todayStr = new Date().toISOString().split('T')[0];
  const userDocRef = doc(this.firestore, 'users', userId);

  return this.getDailyChallenges().pipe(
    switchMap(dailies => {
      if (!dailies || dailies.length === 0) return of([]);
      return from(getDoc(userDocRef)).pipe(
        switchMap(userSnap => {
          const userData: any = userSnap.exists() ? userSnap.data() : {};
          const assignedIds: string[] | undefined = userData?.['assignedDailyIds'];
          const assignedDate: string | undefined = userData?.['assignedDailyDate'];
          if (assignedIds && assignedDate === todayStr) {
            const assigned = assignedIds.map(id => dailies.find(c => c.id === id)).filter(Boolean) as ChallengeModel[];
            return of(assigned);
          }
          const chosen = this.pickRandom(dailies, 3);
          const chosenIds = chosen.map(c => c.id).filter(Boolean);
          return from(updateDoc(userDocRef, { assignedDailyIds: chosenIds, assignedDailyDate: todayStr })).pipe(
            map(() => chosen),
            catchError(() => of(chosen))
          );
        })
      );
    }),
    catchError(err => {
      console.error('[ChallengeService] getDailyChallengesOfTheDay error', err);
      return of(null);
    })
  );
}

/**
 * Returns 7 weekly challenges for the current user, persistent for the week.
 * Persists `assignedWeeklyIds` and `assignedWeeklyWeek` on users/{uid}.
 */
getWeeklyChallengesOfTheWeek(): Observable<ChallengeModel[] | null> {
  const userId = this.auth.currentUser?.uid;
  if (!userId) return of(null);
  const weekKey = this.getWeekKey(new Date());
  const userDocRef = doc(this.firestore, 'users', userId);

  return this.getWeeklyChallenges().pipe(
    switchMap(weeklies => {
      if (!weeklies || weeklies.length === 0) return of([]);
      return from(getDoc(userDocRef)).pipe(
        switchMap(userSnap => {
          const userData: any = userSnap.exists() ? userSnap.data() : {};
          const assignedIds: string[] | undefined = userData?.['assignedWeeklyIds'];
          const assignedWeek: string | undefined = userData?.['assignedWeeklyWeek'];
          if (assignedIds && assignedWeek === weekKey) {
            const assigned = assignedIds.map(id => weeklies.find(c => c.id === id)).filter(Boolean) as ChallengeModel[];
            return of(assigned);
          }
          const chosen = this.pickRandom(weeklies, 7);
          const chosenIds = chosen.map(c => c.id).filter(Boolean);
          return from(updateDoc(userDocRef, { assignedWeeklyIds: chosenIds, assignedWeeklyWeek: weekKey })).pipe(
            map(() => chosen),
            catchError(() => of(chosen))
          );
        })
      );
    }),
    catchError(err => {
      console.error('[ChallengeService] getWeeklyChallengesOfTheWeek error', err);
      return of(null);
    })
  );
}

  // -------------------------------------------------------
  // SEED CHALLENGES (Admin)
  // -------------------------------------------------------
  async seedChallenges(): Promise<void> {
    const dailyChallenges: ChallengeModel[] = [
      { title: '100 Push-ups', description: 'Complete 100 push-ups today', type: 'daily', points: 50, difficulty: 'Medium', category: 'Strength' },
      { title: '5K Run', description: 'Run 5 kilometers', type: 'daily', points: 75, difficulty: 'Hard', category: 'Cardio' },
      { title: '500 Squats', description: 'Complete 500 squats', type: 'daily', points: 60, difficulty: 'Hard', category: 'Strength' },
      { title: '10 Min Plank', description: 'Hold plank for 10 minutes total', type: 'daily', points: 80, difficulty: 'Hard', category: 'Strength' },
      { title: 'No Sugar Day', description: 'Avoid sugar for 24 hours', type: 'daily', points: 40, difficulty: 'Medium', category: 'Nutrition' },
      { title: '2L Water', description: 'Drink 2 liters of water', type: 'daily', points: 30, difficulty: 'Easy', category: 'Nutrition' },
      { title: 'Morning Yoga', description: 'Complete 30 min yoga session', type: 'daily', points: 45, difficulty: 'Easy', category: 'Flexibility' },
      { title: 'Stairs Challenge', description: 'Climb 20 flights of stairs', type: 'daily', points: 55, difficulty: 'Medium', category: 'Cardio' },
      { title: 'Meal Prep', description: 'Prepare healthy meals for tomorrow', type: 'daily', points: 35, difficulty: 'Easy', category: 'Nutrition' },
      { title: 'Stretch Session', description: '20 minutes of stretching', type: 'daily', points: 25, difficulty: 'Easy', category: 'Flexibility' },
      { title: 'Breathing Exercises', description: 'Practice deep breathing for 10 minutes', type: 'daily', points: 30, difficulty: 'Easy', category: 'Flexibility' },
      { title: 'Sleep Quality', description: 'Get 8 hours of quality sleep', type: 'daily', points: 40, difficulty: 'Medium', category: 'Consistency' },
      { title: 'No Processed Food', description: 'Avoid all processed foods today', type: 'daily', points: 50, difficulty: 'Medium', category: 'Nutrition' },
      { title: 'Rainbow Plate', description: 'Eat 3 different colored vegetables', type: 'daily', points: 35, difficulty: 'Easy', category: 'Nutrition' },
      { title: 'Burpee Challenge', description: 'Complete 100 burpees throughout the day', type: 'daily', points: 70, difficulty: 'Hard', category: 'Cardio' },
      { title: 'Pull-up Progress', description: 'Do 5 sets of max pull-ups', type: 'daily', points: 65, difficulty: 'Hard', category: 'Strength' },
      { title: 'Stair Master', description: 'Walk up 30 flights of stairs', type: 'daily', points: 55, difficulty: 'Medium', category: 'Cardio' },
      { title: 'Core Circuit', description: 'Complete 3 rounds of core exercises', type: 'daily', points: 50, difficulty: 'Medium', category: 'Strength' },
      { title: 'Focus Time', description: 'No phone during workouts', type: 'daily', points: 25, difficulty: 'Easy', category: 'Consistency' },
      { title: 'Active Recovery', description: 'Light stretching before bed', type: 'daily', points: 20, difficulty: 'Easy', category: 'Flexibility' },
      { title: 'Step Goal Plus', description: 'Walk 12,000 steps', type: 'daily', points: 45, difficulty: 'Medium', category: 'Cardio' },
      { title: 'Yoga Flow', description: 'Complete a 20-minute yoga routine', type: 'daily', points: 35, difficulty: 'Easy', category: 'Flexibility' },
      { title: 'Protein Power', description: 'Consume 30g protein per meal', type: 'daily', points: 40, difficulty: 'Medium', category: 'Nutrition' },
      { title: 'No Late Snacks', description: 'Stop eating 3 hours before bedtime', type: 'daily', points: 30, difficulty: 'Medium', category: 'Nutrition' },
      { title: 'Jumping Jacks', description: 'Complete 500 jumping jacks', type: 'daily', points: 45, difficulty: 'Medium', category: 'Cardio' }
    ];

    const weeklyChallenges: ChallengeModel[] = [
      { title: 'Week Warrior', description: 'Workout 5 days this week', type: 'weekly', points: 200, difficulty: 'Medium', category: 'Consistency' },
      { title: 'Clean Eating', description: 'Eat healthy all week', type: 'weekly', points: 150, difficulty: 'Medium', category: 'Nutrition' },
      { title: '50K Steps', description: 'Walk 50,000 steps this week', type: 'weekly', points: 175, difficulty: 'Hard', category: 'Cardio' },
      { title: 'Strength Builder', description: 'Complete 3 strength sessions', type: 'weekly', points: 180, difficulty: 'Medium', category: 'Strength' },
      { title: 'Cardio King', description: 'Log 2 hours of cardio', type: 'weekly', points: 190, difficulty: 'Hard', category: 'Cardio' },
      { title: 'Early Bird', description: 'Workout before 8 AM daily', type: 'weekly', points: 160, difficulty: 'Hard', category: 'Consistency' },
      { title: 'Hydration Hero', description: 'Drink 2L water daily', type: 'weekly', points: 140, difficulty: 'Easy', category: 'Nutrition' },
      { title: 'Yoga Week', description: 'Complete 4 yoga sessions', type: 'weekly', points: 155, difficulty: 'Easy', category: 'Flexibility' },
      { title: 'Core Focus', description: '30 min of core work daily', type: 'weekly', points: 170, difficulty: 'Medium', category: 'Strength' },
      { title: 'Consistency Champion', description: 'No missed workouts', type: 'weekly', points: 250, difficulty: 'Hard', category: 'Consistency' },
      { title: 'Digital Discipline', description: 'No phone first hour after waking', type: 'weekly', points: 160, difficulty: 'Hard', category: 'Consistency' },
      { title: 'Meal Timing', description: 'Eat meals at consistent times daily', type: 'weekly', points: 140, difficulty: 'Medium', category: 'Nutrition' },
      { title: 'Sleep Routine', description: 'Same bedtime and wake-up time daily', type: 'weekly', points: 150, difficulty: 'Medium', category: 'Consistency' },
      { title: 'Bodyweight Beast', description: 'Complete 5 full-body bodyweight workouts', type: 'weekly', points: 220, difficulty: 'Hard', category: 'Strength' },
      { title: 'Endurance Builder', description: 'Complete 4 cardio sessions (30+ min)', type: 'weekly', points: 200, difficulty: 'Hard', category: 'Cardio' },
      { title: 'Breathing Routine', description: 'Practice breathing exercises daily', type: 'weekly', points: 130, difficulty: 'Medium', category: 'Flexibility' },
      { title: 'Home Cooking', description: 'Prepare all meals from scratch', type: 'weekly', points: 180, difficulty: 'Hard', category: 'Nutrition' },
      { title: 'Flexibility Focus', description: 'Daily stretching routine (20+ min)', type: 'weekly', points: 155, difficulty: 'Medium', category: 'Flexibility' },
      { title: 'Clean Eating', description: 'No added sugars or processed foods', type: 'weekly', points: 200, difficulty: 'Hard', category: 'Nutrition' },
      { title: 'Two-a-Day', description: 'Morning and evening workouts 3 times', type: 'weekly', points: 240, difficulty: 'Hard', category: 'Consistency' },
      { title: 'Outdoor Cardio', description: 'All cardio sessions done outdoors', type: 'weekly', points: 170, difficulty: 'Medium', category: 'Cardio' },
      { title: 'Macro Master', description: 'Hit daily macro nutrient targets', type: 'weekly', points: 190, difficulty: 'Hard', category: 'Nutrition' },
      { title: 'Recovery Routine', description: 'Foam rolling after every workout', type: 'weekly', points: 145, difficulty: 'Medium', category: 'Flexibility' },
      { title: 'Skill Development', description: 'Practice handstands or mobility daily', type: 'weekly', points: 165, difficulty: 'Medium', category: 'Flexibility' },
      { title: 'Active Days', description: '10,000+ steps every day', type: 'weekly', points: 175, difficulty: 'Hard', category: 'Consistency' }
    ];

    for (const challenge of [...dailyChallenges, ...weeklyChallenges]) {
      await addDoc(this.challengesCollection, {
        ...challenge,
        createdAt: new Date()
      });
    }

    console.log('Challenges seeded successfully!');
  }
}
