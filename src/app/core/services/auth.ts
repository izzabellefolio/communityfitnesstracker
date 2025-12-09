// auth.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth as FirebaseAuth,
  authState,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  docData,
  serverTimestamp
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { switchMap, map, catchError, takeUntil } from 'rxjs/operators';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: any;
  gender?: 'male' | 'female' | 'other' | null;
  weight?: number | null;
  height?: number | null;
  metabolism?: 'slow' | 'medium' | 'fast' | null;
}

@Injectable({ providedIn: 'root' })
export class Auth implements OnDestroy {
  private destroy$ = new Subject<void>();

  private _user = new BehaviorSubject<AppUser | null>(null);
  readonly user$ = this._user.asObservable();

  constructor(
    private auth: FirebaseAuth,
    private firestore: Firestore,
    private router: Router
  ) {
    authState(this.auth)
      .pipe(
        switchMap(user => {
          if (!user) return of(null);

          const userRef = doc(this.firestore, `users/${user.uid}`);

          return docData(userRef).pipe(
            map(doc => ({
              uid: user.uid,
              email: user.email,
              displayName: doc?.['displayName'] ?? user.displayName ?? null,
              photoURL: doc?.['photoURL'] ?? user.photoURL ?? null,
              createdAt: doc?.['createdAt'] ?? null,
              gender: doc?.['gender'] ?? null,
              weight: doc?.['weight'] ?? null,
              height: doc?.['height'] ?? null,
              metabolism: doc?.['metabolism'] ?? null
            }) as AppUser),
            catchError(() => of(null))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(user => this._user.next(user));
  }

  get isAuthenticated$(): Observable<boolean> {
    return this.user$.pipe(map(Boolean));
  }

  // Register user
  async register(email: string, password: string, displayName?: string) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    const user = cred.user;

    if (displayName) {
      await updateProfile(user, { displayName });
    }

    const userRef = doc(this.firestore, `users/${user.uid}`);

    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email,
        displayName: displayName ?? user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        createdAt: serverTimestamp(),
        gender: null,
        weight: null,
        height: null,
        metabolism: null,
        points: 0,
        lastPointsUpdate: serverTimestamp()
      },
      { merge: true }
    );

    // ✅ DO NOT manually emit user
    return user;
  }

  // Login
  async login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    return cred.user;
  }

  // Logout
  async logout() {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }

  // Password reset
  async sendPasswordResetEmail(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  // Get ID token
  getIdToken(): Promise<string | null> {
    return this.auth.currentUser?.getIdToken() ?? Promise.resolve(null);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
