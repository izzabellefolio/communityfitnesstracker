import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  doc,
  setDoc,
  Timestamp,
  collectionData,
  limit
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, User as FirebaseUser } from '@angular/fire/auth';
import { Observable, from, of, BehaviorSubject, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { WorkoutLogModel, UserStats } from '../../shared/models/workout-log.model';
import { Routine } from '../../shared/models/routine.model';
import { Exercise, UserMetrics } from '../../shared/models';

export interface DailyProgress {
  id?: string;
  userId: string;
  date: Date;
  caloriesBurned?: number;
  workoutsCompleted?: number;
  steps?: number;
  mood?: string;
}

export interface WorkoutLog {
  id?: string;
  userId: string;
  date: Date;
  totalCalories: number;
  totalDuration: number;
  exercises: any[];
  intensityScore?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProgressService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private statsSubject = new BehaviorSubject<UserStats>({
    streak: 0,
    totalWorkouts: 0,
    totalReps: 0,
    caloriesBurned: 0,
    currentWeight: 70,
    lastWorkoutDate: null as any,
  });
  stats$ = this.statsSubject.asObservable();

  // ---- Helpers ----
  private getCurrentUserOnce(): Promise<FirebaseUser | null> {
    if (this.auth.currentUser) return Promise.resolve(this.auth.currentUser);

    return new Promise(resolve => {
      const unsub = onAuthStateChanged(this.auth as any, user => {
        unsub();
        resolve(user);
      });
    });
  }

  private toDate(value: any): Date | undefined {
    if (!value) return undefined;
    if (value.toDate) return value.toDate();
    return new Date(value);
  }

  private sanitizeStatsForWrite(stats: UserStats): any {
    return {
      ...stats,
      lastWorkoutDate: stats.lastWorkoutDate ? stats.lastWorkoutDate : null
    };
  }

  // ---- User Metrics - FIXED VERSION ----
  getUserMetrics(userId: string): Observable<UserMetrics | null> {
    console.log('getUserMetrics called for userId:', userId);
    
    const metricsRef = collection(this.firestore, 'userMetrics');
    const q = query(
      metricsRef,
      where('userId', '==', userId),
      orderBy('lastUpdated', 'desc'),
      limit(1)
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        console.log('Firestore query results:', snapshot.docs.length, 'documents');
        
        if (!snapshot.docs.length) {
          console.log('No metrics found for user:', userId);
          return null;
        }
        
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        console.log('Found metrics data:', data);
        
        // Handle Timestamp conversion
        let lastUpdated: Date;
        if (data['lastUpdated']?.toDate) {
          lastUpdated = data['lastUpdated'].toDate();
        } else if (data['lastUpdated'] instanceof Date) {
          lastUpdated = data['lastUpdated'];
        } else if (data['lastUpdated']) {
          lastUpdated = new Date(data['lastUpdated']);
        } else {
          lastUpdated = new Date();
        }
        
        const metrics: UserMetrics = {
          id: docSnap.id,
          userId: data['userId'] || userId,
          weight: data['weight'] || 0,
          height: data['height'] || 0,
          metabolism: data['metabolism'] || 'medium',
          gender: data['gender'] || 'other',
          bmi: data['bmi'] || 0,
          lastUpdated: lastUpdated
        };
        
        console.log('Parsed metrics:', metrics);
        return metrics;
      }),
      catchError(error => {
        console.error('Error fetching user metrics:', error);
        return of(null);
      })
    );
  }

  saveUserMetrics(
    userId: string,
    metrics: Omit<UserMetrics, 'userId' | 'lastUpdated' | 'bmi'>
  ): Promise<any> {
    console.log('saveUserMetrics called for userId:', userId, 'with metrics:', metrics);
    
    const metricsRef = collection(this.firestore, 'userMetrics');

    // Calculate BMI
    const bmi = this.calculateBMI(metrics.weight, metrics.height);
    console.log('Calculated BMI:', bmi);
    
    // Create document data with Firestore Timestamp
    const metricsData = {
      userId: userId,
      weight: metrics.weight,
      height: metrics.height,
      metabolism: metrics.metabolism,
      gender: metrics.gender || 'other',
      bmi: bmi,
      lastUpdated: Timestamp.now() // Use Firestore Timestamp
    };

    console.log('Saving to Firestore:', metricsData);

    return addDoc(metricsRef, metricsData)
      .then(async (docRef) => {
        console.log('Metrics saved successfully, document ID:', docRef.id);
        
        // Also update userStats with current weight and notify subscribers
      try {
        const statsRef = doc(this.firestore, `userStats/${userId}`);
        const updatedStats = { ...(this.statsSubject.value || {}), currentWeight: metrics.weight };
        // Persist sanitized stats (avoid undefined fields)
        await setDoc(statsRef, this.sanitizeStatsForWrite(updatedStats), { merge: true });
        // Push to BehaviorSubject so UI updates immediately
        this.statsSubject.next(updatedStats);
        console.log('Updated userStats with weight and notified subscribers:', metrics.weight);
      } catch (statsError) {
        console.warn('Could not update userStats:', statsError);
      }
        
        return docRef;
      })
      .catch(error => {
        console.error('Error saving user metrics:', error);
        throw error;
      });
  }

  // Alternative: Save or update metrics in a single document per user
  saveUserMetricsV2(
    userId: string,
    metrics: Omit<UserMetrics, 'userId' | 'lastUpdated' | 'bmi'>
  ): Promise<void> {
    console.log('saveUserMetricsV2 called for userId:', userId);
    
    // Use a single document per user instead of collection
    const userMetricsDoc = doc(this.firestore, `userMetrics/${userId}`);
    
    const bmi = this.calculateBMI(metrics.weight, metrics.height);
    
    const metricsData = {
      userId: userId,
      weight: metrics.weight,
      height: metrics.height,
      metabolism: metrics.metabolism,
      gender: metrics.gender || 'other',
      bmi: bmi,
      lastUpdated: Timestamp.now()
    };

    return setDoc(userMetricsDoc, metricsData, { merge: true })
      .then(() => {
        console.log('User metrics saved/updated successfully for:', userId);
        
        // Update userStats
        const statsRef = doc(this.firestore, `userStats/${userId}`);
        return setDoc(statsRef, {
          currentWeight: metrics.weight,
          lastUpdated: Timestamp.now()
        }, { merge: true });
      })
      .then(() => {
        console.log('User stats updated successfully');
      })
      .catch(error => {
        console.error('Error in saveUserMetricsV2:', error);
        throw error;
      });
  }

  private calculateBMI(weight: number, height: number): number {
    if (!weight || !height) return 0;
    const h = height / 100;
    const bmi = weight / (h * h);
    return Number(bmi.toFixed(1));
  }

  // ---- Workout logs ----
  getUserWorkoutLogs(): Observable<WorkoutLogModel[]> {
    return from(this.getCurrentUserOnce()).pipe(
      switchMap(user => {
        if (!user) return of([] as WorkoutLogModel[]);
        const logsRef = collection(this.firestore, `users/${user.uid}/workoutLogs`);
        const q = query(logsRef, orderBy('date', 'desc'));
        return from(getDocs(q)).pipe(
          map(snapshot =>
            snapshot.docs.map(docSnap => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                ...data,
                date: this.toDate(data['date']),
              } as WorkoutLogModel;
            })
          )
        );
      })
    );
  }

  getUserWorkoutLogsOnce(): Observable<WorkoutLogModel[]> {
    const user = this.auth.currentUser;
    if (!user) return throwError(() => new Error('User not authenticated'));
    const logsRef = collection(this.firestore, `users/${user.uid}/workoutLogs`);
    return from(getDocs(logsRef)).pipe(
      map(snapshot => snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as WorkoutLogModel))
    );
  }

  // ---- Calories calculation ----
  private calculateCalories(exercises: Exercise[]): number {
    return exercises.reduce((total, ex) => {
      const caloriesPerRep = 0.5;
      const caloriesPerMinute = 5;
      const repsCalories = (ex.reps || 0) * (ex.sets || 0) * caloriesPerRep;
      const durationCalories = (ex.duration || 0) * caloriesPerMinute;
      return total + repsCalories + durationCalories;
    }, 0);
  }

  // ---- User Stats ----
  getUserStats(): Observable<UserStats> {
    return from(this.getCurrentUserOnce()).pipe(
      switchMap(user => {
        if (!user) return of(this.statsSubject.value);

        const statsRef = doc(this.firestore, `userStats/${user.uid}`);
        return from(getDoc(statsRef)).pipe(
          switchMap(docSnap => {
            const baseStats: UserStats = docSnap.exists()
              ? {
                  streak: docSnap.data()['streak'] ?? 0,
                  totalWorkouts: docSnap.data()['totalWorkouts'] ?? 0,
                  totalReps: docSnap.data()['totalReps'] ?? 0,
                  caloriesBurned: docSnap.data()['caloriesBurned'] ?? 0,
                  currentWeight: docSnap.data()['currentWeight'] ?? 70,
                  lastWorkoutDate: this.toDate(docSnap.data()['lastWorkoutDate']),
                }
              : this.statsSubject.value;

            return this.getUserWorkoutLogs().pipe(
              map(logs => {
                const lastWorkoutDate = logs[0]?.date;
                const updated: UserStats = { ...baseStats, lastWorkoutDate };
                this.statsSubject.next(updated);
                return updated;
              })
            );
          })
        );
      })
    );
  }

  fetchInitialStats(): void {
    this.getUserStats().subscribe({
      next: stats => console.debug('[Progress] Initial stats fetched', stats),
      error: err => console.error('[Progress] fetchInitialStats error', err),
    });
  }

  // ---- Logging a workout ----
  logWorkout(routine: Routine, notes?: string): Observable<string> {
    return from(this.getCurrentUserOnce()).pipe(
      switchMap(user => {
        if (!user) return throwError(() => new Error('User not authenticated'));

        const totalReps = routine.exercises.reduce(
          (sum, ex) => sum + ((ex.reps || 0) * (ex.sets || 0)),
          0
        );

        const caloriesBurned = this.calculateCalories(routine.exercises);
        const duration = routine.exercises.reduce((sum, ex) => sum + (ex.duration || 0), 0);

        const workoutLog: WorkoutLogModel = {
          userId: user.uid,
          routineId: routine.id || '',
          routineName: routine.name,
          date: Timestamp.fromDate(new Date()) as any,
          exercises: routine.exercises,
          totalReps,
          caloriesBurned,
          duration,
          notes: notes || '',
          completed: true,
        };

        const userLogRef = collection(this.firestore, `users/${user.uid}/workoutLogs`);
        console.debug('[Progress] Logging workout to', userLogRef, workoutLog);

        return from(addDoc(userLogRef, workoutLog)).pipe(
          switchMap(docRef =>
            this.updateUserStats().pipe(
              map(() => docRef.id),
              catchError(err => {
                console.error('[Progress] updateUserStats FAILED (workout saved anyway):', err);
                return of(docRef.id);
              })
            )
          ),
          catchError(err => {
            console.error('[Progress] addDoc FAILED - workout not logged:', err);
            return throwError(() => err);
          })
        );
      })
    );
  }

  // ---- Updating aggregated stats ----
  updateUserStats(): Observable<UserStats> {
    return from(this.getCurrentUserOnce()).pipe(
      switchMap(user => {
        if (!user) return of(this.statsSubject.value);

        return this.getUserWorkoutLogs().pipe(
          switchMap(logs => {
            // Compute streak safely
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const logDates = logs
              .map(l => {
                const d = this.toDate(l.date);
                if (!d) return 0;
                d.setHours(0, 0, 0, 0);
                return d.getTime();
              })
              .filter(ts => ts > 0)
              .sort((a, b) => b - a);

            let streak = 0;
            for (const dateMs of logDates) {
              const expected = new Date(today);
              expected.setDate(today.getDate() - streak);
              if (dateMs === expected.getTime()) streak++;
              else break;
            }

            const stats: UserStats = {
              streak,
              totalWorkouts: logs.length,
              totalReps: logs.reduce((sum, l) => sum + (l.totalReps || 0), 0),
              caloriesBurned: logs.reduce((sum, l) => sum + (l.caloriesBurned || 0), 0),
              currentWeight: this.statsSubject.value.currentWeight,
              lastWorkoutDate: logs[0]?.date,
            };

            const statsRef = doc(this.firestore, `userStats/${user.uid}`);
            return from(setDoc(statsRef, this.sanitizeStatsForWrite(stats), { merge: true })).pipe(
              map(() => {
                this.statsSubject.next(stats);
                return stats;
              })
            );
          })
        );
      })
    );
  }

  // ---- Update user weight ----
  updateWeight(weight: number): Observable<void> {
    return from(this.getCurrentUserOnce()).pipe(
      switchMap(user => {
        if (!user) return throwError(() => new Error('User not authenticated'));
        const statsRef = doc(this.firestore, `userStats/${user.uid}`);
        const updatedStats = { ...(this.statsSubject.value || {}), currentWeight: weight };
        return from(setDoc(statsRef, this.sanitizeStatsForWrite(updatedStats), { merge: true })).pipe(
          map(() => {
            this.statsSubject.next(updatedStats);
          })
        );
      })
    );
  }

  // -------------------- DAILY PROGRESS --------------------

  getDailyProgress(userId: string, days: number = 7): Observable<DailyProgress[]> {
    const progressRef = collection(this.firestore, 'dailyProgress');
    const q = query(
      progressRef,
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(days)
    );
    return collectionData(q, { idField: 'id' }) as Observable<DailyProgress[]>;
  }

  /**
   * Aggregate daily progress from the user's workout subcollection.
   * This computes calories and total reps per day from `users/{uid}/workoutLogs`.
   */
  getDailyProgressFromLogs(days: number = 7): Observable<DailyProgress[]> {
    return this.getUserWorkoutLogs().pipe(
      map((logs: WorkoutLogModel[]) => {
        const mapByDay = new Map<string, DailyProgress>();
        for (const l of logs) {
          const d = this.toDate(l.date);
          if (!d) continue;
          const key = d.toISOString().slice(0, 10);
          const existing = mapByDay.get(key) || { userId: l.userId, date: new Date(key), caloriesBurned: 0, workoutsCompleted: 0 } as DailyProgress;
          existing.caloriesBurned = (existing.caloriesBurned || 0) + (l.caloriesBurned || 0);
          existing.workoutsCompleted = (existing.workoutsCompleted || 0) + 1;
          // attach totalReps for charting convenience
          (existing as any).totalReps = ((existing as any).totalReps || 0) + (l.totalReps || 0);
          mapByDay.set(key, existing);
        }

        const arr = Array.from(mapByDay.values())
          .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
          .slice(0, days);
        return arr;
      })
    );
  }

  updateDailyProgress(
    userId: string,
    progressData: Partial<DailyProgress>
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const progressId = `${userId}_${today.toISOString().slice(0, 10)}`;
    const progressDoc = doc(this.firestore, 'dailyProgress', progressId);

    return setDoc(
      progressDoc,
      {
        id: progressId,
        userId,
        date: today,
        ...progressData
      },
      { merge: true }
    );
  }

  // -------------------- WORKOUT HISTORY --------------------

  getWorkoutHistory(userId: string, limitCount: number = 30) {
    const workoutsRef = collection(this.firestore, 'workoutLogs');
    const q = query(
      workoutsRef,
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    return collectionData(q, { idField: 'id' }) as Observable<WorkoutLog[]>;
  }
}