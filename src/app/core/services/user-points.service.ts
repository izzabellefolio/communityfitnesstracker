import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc, Timestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, switchMap, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UserPointsService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private userPointsSubject = new BehaviorSubject<number>(0);
  userPoints$ = this.userPointsSubject.asObservable().pipe(
    distinctUntilChanged()
  );

  constructor() {
    // Initialize points when auth state changes
    this.initializeUserPoints();
  }

  // Initialize user points on auth change
  private initializeUserPoints() {
    const userId = this.auth.currentUser?.uid;
    if (userId) {
      this.fetchUserPoints(userId).subscribe();
    }
  }

  // Fetch user points from Firestore
  fetchUserPoints(userId: string): Observable<number> {
    if (!userId) return of(0);

    const userRef = doc(this.firestore, 'users', userId);

    return from(getDoc(userRef)).pipe(
      map(snapshot => {
        const points = snapshot.data()?.['points'] || 0;
        this.userPointsSubject.next(points);
        return points;
      }),
      catchError(error => {
        console.error('Error fetching user points:', error);
        return of(0);
      })
    );
  }

  // Get current points snapshot
  getPointsSnapshot(): number {
    return this.userPointsSubject.value;
  }

  // Add points to user
  addPoints(points: number): Observable<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId || points <= 0) return of(void 0);

    const userRef = doc(this.firestore, 'users', userId);

    return from(getDoc(userRef)).pipe(
      switchMap(snapshot => {
        const currentPoints = snapshot.data()?.['points'] || 0;
        const newPoints = currentPoints + points;

        return from(updateDoc(userRef, {
          points: newPoints,
          lastPointsUpdate: Timestamp.now()
        }));
      }),
      switchMap(() => {
        // Refresh points after update
        return this.fetchUserPoints(userId);
      }),
      map(() => void 0),
      catchError(error => {
        console.error('Error adding points:', error);
        return of(void 0);
      })
    );
  }

  // Set points to a specific value
  setPoints(points: number): Observable<void> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(void 0);

    const userRef = doc(this.firestore, 'users', userId);

    return from(updateDoc(userRef, {
      points: Math.max(0, points),
      lastPointsUpdate: Timestamp.now()
    })).pipe(
      switchMap(() => {
        return this.fetchUserPoints(userId);
      }),
      map(() => void 0),
      catchError(error => {
        console.error('Error setting points:', error);
        return of(void 0);
      })
    );
  }
}
