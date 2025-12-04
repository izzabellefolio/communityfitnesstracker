// progress.service.ts
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
  Timestamp
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, User as FirebaseUser } from '@angular/fire/auth';
import { Observable, from, of, BehaviorSubject, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { WorkoutLogModel, UserStats } from '../../shared/models/workout-log.model';
import { Routine } from '../../shared/models/routine.model';
import { Exercise } from '../../shared/models';

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
    lastWorkoutDate: undefined,
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
            return from(setDoc(statsRef, stats, { merge: true })).pipe(
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
        const updatedStats = {
          ...this.statsSubject.value,
          currentWeight: weight,
        };
        return from(setDoc(statsRef, updatedStats, { merge: true })).pipe(
          map(() => {
            this.statsSubject.next(updatedStats);
          })
        );
      })
    );
  }
}