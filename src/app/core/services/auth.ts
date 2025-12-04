// auth.ts (modular Firebase)
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Auth as FirebaseAuth, authState, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, docData } from '@angular/fire/firestore';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: any;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private _user = new BehaviorSubject<AppUser | null>(null);
  user$ = this._user.asObservable();

  constructor(
    private auth: FirebaseAuth,
    private firestore: Firestore,
    private router: Router
  ) {
    // Listen to auth state
    authState(this.auth)
      .pipe(
        switchMap(user => {
          if (!user) return of(null); // no user, return null

          const userRef = doc(this.firestore, `users/${user.uid}`);
          // Combine Auth data with Firestore docData
          return docData(userRef).pipe(
            map(doc => ({
              uid: user.uid,
              email: user.email,
              displayName: doc?.['displayName'] || user.displayName || null,
              photoURL: doc?.['photoURL'] || user.photoURL || null,
              createdAt: doc?.['createdAt'] || new Date()
            } as AppUser))
          );
        })
      )
      .subscribe(this._user);
  }

  get isAuthenticated(): boolean {
    return !!this.auth.currentUser;
  }

  // Register user
  async register(email: string, password: string, displayName?: string) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    const user = cred.user;
    if (displayName) await updateProfile(user, { displayName });

    const userDoc: AppUser = {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || null,
      photoURL: user.photoURL || null,
      createdAt: new Date()
    };

    const userRef = doc(this.firestore, `users/${user.uid}`);
    await setDoc(userRef, userDoc, { merge: true });

    this._user.next(userDoc); // update BehaviorSubject immediately
    return userDoc;
  }

  // Login
  async login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const user = cred.user;

    const userRef = doc(this.firestore, `users/${user.uid}`);
    const userDoc: AppUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null
    };
    await setDoc(userRef, userDoc, { merge: true });

    this._user.next(userDoc); // update BehaviorSubject immediately
    return user;
  }

  // Logout
  async logout() {
    await this.auth.signOut();
    this._user.next(null); // reset BehaviorSubject
    await this.router.navigate(['/login']);
  }

  // Password reset
  async sendPasswordResetEmail(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  // Get ID token
  getIdToken(): Promise<string | null> {
    return this.auth.currentUser?.getIdToken() || Promise.resolve(null);
  }
}
