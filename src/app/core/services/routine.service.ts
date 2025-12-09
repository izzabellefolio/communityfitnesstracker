import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, collectionData, docData, query, where } from '@angular/fire/firestore';
import { onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore'; // added getDoc
import { Auth } from '@angular/fire/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Routine } from '../../shared/models/routine.model';

@Injectable({
  providedIn: 'root'
})
export class RoutineService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private routinesCollection = collection(this.firestore, 'routines');

  // ==============================
  // Get all routines for current user (real-time)
  // ==============================
  getUserRoutines(): Observable<Routine[]> {
    return new Observable<Routine[]>(observer => {
      let unsubscribeSnapshot: (() => void) | null = null;

      const unsubscribeAuth = onAuthStateChanged(this.auth as any, user => {
        if (!user) {
          observer.next([]);
          return;
        }

        const userId = user.uid;
        const q = query(this.routinesCollection, where('userId', '==', userId));

        unsubscribeSnapshot = onSnapshot(q, snapshot => {
          const routines = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Routine) }));
          observer.next(routines);
        }, error => {
          observer.error(error);
        });

        return () => {
          if (unsubscribeSnapshot) try { unsubscribeSnapshot(); } catch {}
          try { unsubscribeAuth(); } catch {}
        }
      });

      return () => unsubscribeAuth();
    });
  }
  

  // ==============================
  // Get a routine by ID (real-time)
  // ==============================
  getRoutineById(id: string): Observable<Routine | null> {
    const routineDoc = doc(this.firestore, 'routines', id);
    return docData(routineDoc, { idField: 'id' }).pipe(
      map(data => data ? (data as Routine) : null)
    );
  }
  getTodayRoutine(userId: string): Observable<Routine[]> {
    const today = new Date().toLocaleString('en-us', { weekday: 'long' }).toLowerCase() as
      | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

    const routinesRef = collection(this.firestore, 'routines');
    const q = query(routinesRef, where('userId', '==', userId));

    return (collectionData(q, { idField: 'id' }) as Observable<Routine[]>).pipe(
      map((arr: Routine[]) => arr.filter(routine =>
        // schedule items may be strings (e.g. 'monday') or objects ({ day: 'monday', time: '09:00' })
        (routine.schedule as any[])?.some((s: any) =>
          typeof s === 'string' ? s.toLowerCase() === today : (s?.day ?? '').toLowerCase() === today
        )
      ))
    );
  }

  // ==============================
  // Create a new routine
  // ==============================
  createRoutine(routine: Routine): Observable<string> {
    return new Observable<string>(observer => {
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        this.addRoutineDoc(routine, currentUser.uid, observer);
      } else {
        let unsubscribed = false;
        const unsubscribe = onAuthStateChanged(this.auth as any, user => {
          if (unsubscribed) return;
          if (user) {
            unsubscribed = true;
            unsubscribe();
            this.addRoutineDoc(routine, user.uid, observer);
          }
        }, (err) => !unsubscribed && observer.error(err));
      }
    });
  }

  private addRoutineDoc(routine: Routine, userId: string, observer: any) {
    const newRoutine = {
      userId,
      name: routine.name || 'Untitled Routine',
      description: routine.description || '',
      schedule: routine.schedule || [],
      time: routine.time || '09:00',
      exercises: routine.exercises || [],
      completedDates: routine.completedDates || [],
      createdAt: serverTimestamp(),
      isPremade: routine.isPremade || false
    };

    addDoc(this.routinesCollection, newRoutine)
      .then(docRef => {
        observer.next(docRef.id);
        observer.complete();
      })
      .catch(err => observer.error(err));
  }

  // ==============================
  // Update routine
  // ==============================
  updateRoutine(routine: Routine): Observable<void> {
    if (!routine.id) throw new Error('Routine ID is required');

    const routineDoc = doc(this.firestore, 'routines', routine.id);

    return new Observable<void>(observer => {
      // one-time fetch to check premade flag then update
      getDoc(routineDoc).then(snapshot => {
        if (!snapshot.exists()) {
          observer.error(new Error('Routine not found'));
          return;
        }
        const existing = snapshot.data() as any;
        // Treat as premade if explicitly marked OR if it has no userId (template)
        const isPremadeDoc = existing.isPremade === true || !existing.userId;
        if (isPremadeDoc) {
          observer.error(new Error('Cannot edit premade routine'));
          return;
        }

        updateDoc(routineDoc, {
          name: routine.name,
          description: routine.description,
          schedule: routine.schedule,
          time: routine.time,
          exercises: routine.exercises,
          completedDates: routine.completedDates || []
        }).then(() => {
          observer.next();
          observer.complete();
        }).catch(err => observer.error(err));
      }).catch(err => observer.error(err));
    });
  }

  // ==============================
  // Delete routine
  // ==============================
  deleteUserRoutine(id: string): Observable<void> {
    const routineDoc = doc(this.firestore, 'routines', id);

    return new Observable<void>(observer => {
      // one-time fetch to validate before delete
      getDoc(routineDoc).then(snapshot => {
        if (!snapshot.exists()) {
          observer.error(new Error('Routine not found'));
          return;
        }
        const routine = snapshot.data() as any;
        if (!routine.userId || routine.isPremade) {
          observer.error(new Error('Cannot delete premade routine'));
          return;
        }
        deleteDoc(routineDoc).then(() => {
          observer.next();
          observer.complete();
        }).catch(err => observer.error(err));
      }).catch(err => observer.error(err));
    });
  }

  // ==============================
  // Clone premade routine
  // ==============================
  clonePremadeRoutine(routine: Routine): Observable<string> {
    return new Observable<string>(observer => {
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        // ensure cloned copy is NOT marked premade so it can be edited/deleted
        const userCopy = { ...routine, isPremade: false };
        this.addRoutineDoc(userCopy, currentUser.uid, observer);
      } else {
        let unsubscribed = false;
        const unsubscribe = onAuthStateChanged(this.auth as any, user => {
          if (unsubscribed) return;
          if (user) {
            unsubscribed = true;
            unsubscribe();
            const userCopy = { ...routine, isPremade: false };
            this.addRoutineDoc(userCopy, user.uid, observer);
          }
        }, (err) => !unsubscribed && observer.error(err));
      }
    });
  }
}