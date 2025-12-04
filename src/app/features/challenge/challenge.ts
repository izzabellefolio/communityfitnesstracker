import { Injectable, inject } from '@angular/core';
import { 
  Firestore, collection, addDoc, getDocs, query, where, 
  orderBy, updateDoc, doc, getDoc, setDoc, Timestamp, deleteDoc,
  serverTimestamp 
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, switchMap, tap, take } from 'rxjs/operators';

export interface ChallengeExercise {
  id: string;
  name: string;
  description: string;
  reps: number;
  sets: number;
  restTime?: number;
  completed: boolean;
  muscleGroup: string;
  equipment?: string;
  targetReps?: number;
  completedReps?: number;
}

export interface DailyChallenge {
  id: string;
  date: string; // YYYY-MM-DD format
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  category: 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed';
  exercises: ChallengeExercise[];
  completed: boolean;
  completionTime?: number; // in minutes
  completedAt?: Timestamp;
  userId?: string;
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  
  private dailyChallengesSubject = new BehaviorSubject<DailyChallenge[]>([]);
  dailyChallenges$ = this.dailyChallengesSubject.asObservable();
  
  private todaysChallengeSubject = new BehaviorSubject<DailyChallenge | null>(null);
  todaysChallenge$ = this.todaysChallengeSubject.asObservable();
  
  private currentDateKey = this.getDateKey(new Date());
  private dateCheckInterval: any;

  constructor() {
    this.initializeDateWatcher();
  }

  // Initialize date watcher to detect day changes
  private initializeDateWatcher() {
    // Check for date changes every 30 seconds
    this.dateCheckInterval = setInterval(() => {
      this.checkDateChange();
    }, 30000);
  }

  // Check if date has changed
  private checkDateChange() {
    const newDateKey = this.getDateKey(new Date());
    
    if (newDateKey !== this.currentDateKey) {
      console.log('Date changed from', this.currentDateKey, 'to', newDateKey);
      this.currentDateKey = newDateKey;
      
      // Clear today's challenge cache
      this.todaysChallengeSubject.next(null);
      
      // Notify subscribers
      this.getTodaysChallenge().subscribe();
    }
  }

  // Get date key in YYYY-MM-DD format
  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Get day name from day number
  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }

  // Get today's challenge
  getTodaysChallenge(): Observable<DailyChallenge> {
    const todayKey = this.getDateKey(new Date());
    const dayOfWeek = new Date().getDay();
    const userId = this.auth.currentUser?.uid;
    
    // Check if we already have today's challenge cached
    const cachedChallenge = this.todaysChallengeSubject.value;
    if (cachedChallenge && cachedChallenge.date === todayKey) {
      return of(cachedChallenge);
    }
    
    if (!userId) {
      return this.generateDefaultChallenge(todayKey, dayOfWeek);
    }

    // Check Firestore for existing challenge
    const challengesRef = collection(this.firestore, 'dailyChallenges');
    const q = query(
      challengesRef,
      where('userId', '==', userId),
      where('date', '==', todayKey)
    );

    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        if (!snapshot.empty) {
          // Found existing challenge
          const docData = snapshot.docs[0].data() as DailyChallenge;
          const challenge = {
            ...docData,
            id: snapshot.docs[0].id
          };
          
          this.todaysChallengeSubject.next(challenge);
          return of(challenge);
        } else {
          // Create new challenge for today
          return this.createDailyChallenge(todayKey, dayOfWeek, userId);
        }
      }),
      catchError(error => {
        console.error('Error getting todays challenge:', error);
        return this.generateDefaultChallenge(todayKey, dayOfWeek);
      })
    );
  }

  // Create new daily challenge
  private createDailyChallenge(dateKey: string, dayOfWeek: number, userId: string): Observable<DailyChallenge> {
    const newChallenge = this.generateDailyChallenge(dateKey, dayOfWeek, userId);
    const challengesRef = collection(this.firestore, 'dailyChallenges');
    
    return from(addDoc(challengesRef, newChallenge)).pipe(
      map(docRef => ({
        ...newChallenge,
        id: docRef.id
      })),
      tap(challenge => {
        // Update subjects
        this.todaysChallengeSubject.next(challenge);
        
        const currentChallenges = this.dailyChallengesSubject.value;
        this.dailyChallengesSubject.next([challenge, ...currentChallenges]);
      }),
      catchError(error => {
        console.error('Error creating challenge:', error);
        return of(newChallenge);
      })
    );
  }

  // Generate daily challenge with exercises
  private generateDailyChallenge(dateKey: string, dayOfWeek: number, userId: string): DailyChallenge {
    const challengeId = `challenge-${dateKey}-${userId}`;
    const exercises = this.generateExercisesForDay(dayOfWeek);
    
    // Determine difficulty based on day
    let difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    let category: 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed';
    
    switch(dayOfWeek) {
      case 0: // Sunday - Mixed
        difficulty = 'Beginner';
        category = 'Mixed';
        break;
      case 1: // Monday - Strength
        difficulty = 'Intermediate';
        category = 'Strength';
        break;
      case 2: // Tuesday - Cardio
        difficulty = 'Intermediate';
        category = 'Cardio';
        break;
      case 3: // Wednesday - Strength
        difficulty = 'Advanced';
        category = 'Strength';
        break;
      case 4: // Thursday - Mixed
        difficulty = 'Intermediate';
        category = 'Mixed';
        break;
      case 5: // Friday - Cardio
        difficulty = 'Advanced';
        category = 'Cardio';
        break;
      case 6: // Saturday - Flexibility
        difficulty = 'Beginner';
        category = 'Flexibility';
        break;
      default:
        difficulty = 'Intermediate';
        category = 'Mixed';
    }
    
    return {
      id: challengeId,
      date: dateKey,
      dayOfWeek: dayOfWeek,
      title: `${this.getDayName(dayOfWeek)} ${category} Challenge`,
      description: this.getChallengeDescription(dayOfWeek, category),
      difficulty: difficulty,
      category: category,
      exercises: exercises,
      completed: false,
      userId: userId,
      createdAt: Timestamp.now()
    };
  }

  // Generate exercises based on day of week
  private generateExercisesForDay(dayOfWeek: number): ChallengeExercise[] {
    const exerciseTemplates = [
      // Sunday - Full Body (Beginner)
      [
        {
          name: 'Bodyweight Squats',
          description: 'Stand with feet shoulder-width apart, lower into squat position',
          reps: 15,
          sets: 3,
          restTime: 60,
          muscleGroup: 'Legs',
          equipment: 'None'
        },
        {
          name: 'Push-ups',
          description: 'Standard push-ups, modify to knees if needed',
          reps: 10,
          sets: 3,
          restTime: 60,
          muscleGroup: 'Chest',
          equipment: 'None'
        },
        {
          name: 'Plank',
          description: 'Hold plank position, keep back straight',
          reps: 1,
          sets: 3,
          restTime: 45,
          muscleGroup: 'Core',
          equipment: 'None'
        }
      ],
      // Monday - Upper Body Strength (Intermediate)
      [
        {
          name: 'Pull-ups',
          description: 'Use assisted machine or bands if needed',
          reps: 8,
          sets: 4,
          restTime: 90,
          muscleGroup: 'Back',
          equipment: 'Pull-up bar'
        },
        {
          name: 'Dumbbell Press',
          description: 'Flat bench dumbbell press',
          reps: 12,
          sets: 3,
          restTime: 75,
          muscleGroup: 'Chest',
          equipment: 'Dumbbells, Bench'
        },
        {
          name: 'Tricep Dips',
          description: 'Using bench or parallel bars',
          reps: 10,
          sets: 3,
          restTime: 60,
          muscleGroup: 'Arms',
          equipment: 'Bench'
        }
      ],
      // Tuesday - Cardio (Intermediate)
      [
        {
          name: 'Jumping Jacks',
          description: 'Continuous for time',
          reps: 50,
          sets: 3,
          restTime: 45,
          muscleGroup: 'Full Body',
          equipment: 'None'
        },
        {
          name: 'High Knees',
          description: 'Run in place bringing knees to chest',
          reps: 30,
          sets: 3,
          restTime: 45,
          muscleGroup: 'Legs',
          equipment: 'None'
        },
        {
          name: 'Mountain Climbers',
          description: 'Alternating knee drives in plank position',
          reps: 20,
          sets: 3,
          restTime: 45,
          muscleGroup: 'Core',
          equipment: 'None'
        }
      ],
      // Wednesday - Lower Body Strength (Advanced)
      [
        {
          name: 'Barbell Squats',
          description: 'Heavy squats with proper form',
          reps: 6,
          sets: 4,
          restTime: 120,
          muscleGroup: 'Legs',
          equipment: 'Barbell, Rack'
        },
        {
          name: 'Romanian Deadlifts',
          description: 'Focus on hamstring stretch',
          reps: 10,
          sets: 3,
          restTime: 90,
          muscleGroup: 'Hamstrings',
          equipment: 'Barbell'
        },
        {
          name: 'Walking Lunges',
          description: 'With dumbbells for added resistance',
          reps: 12,
          sets: 3,
          restTime: 75,
          muscleGroup: 'Legs',
          equipment: 'Dumbbells'
        }
      ],
      // Thursday - Mixed (Intermediate)
      [
        {
          name: 'Burpees',
          description: 'Full burpee with push-up',
          reps: 10,
          sets: 3,
          restTime: 60,
          muscleGroup: 'Full Body',
          equipment: 'None'
        },
        {
          name: 'Russian Twists',
          description: 'With weight for added resistance',
          reps: 20,
          sets: 3,
          restTime: 45,
          muscleGroup: 'Core',
          equipment: 'Weight plate'
        },
        {
          name: 'Box Jumps',
          description: 'Explosive jumps onto box',
          reps: 8,
          sets: 3,
          restTime: 75,
          muscleGroup: 'Legs',
          equipment: 'Box or platform'
        }
      ],
      // Friday - Cardio (Advanced)
      [
        {
          name: 'Sprints',
          description: '20 second sprint, 40 second rest',
          reps: 8,
          sets: 1,
          restTime: 40,
          muscleGroup: 'Legs',
          equipment: 'Treadmill or track'
        },
        {
          name: 'Battle Ropes',
          description: 'Alternating waves for time',
          reps: 1,
          sets: 3,
          restTime: 60,
          muscleGroup: 'Upper Body',
          equipment: 'Battle ropes'
        },
        {
          name: 'Rower',
          description: '500 meter row for time',
          reps: 1,
          sets: 3,
          restTime: 90,
          muscleGroup: 'Full Body',
          equipment: 'Rowing machine'
        }
      ],
      // Saturday - Flexibility (Beginner)
      [
        {
          name: 'Sun Salutations',
          description: 'Yoga flow sequence',
          reps: 5,
          sets: 1,
          restTime: 30,
          muscleGroup: 'Full Body',
          equipment: 'Yoga mat'
        },
        {
          name: 'Pigeon Pose',
          description: 'Hold each side for flexibility',
          reps: 1,
          sets: 2,
          restTime: 0,
          muscleGroup: 'Hips',
          equipment: 'Yoga mat'
        },
        {
          name: 'Child\'s Pose',
          description: 'Restorative stretch',
          reps: 1,
          sets: 1,
          restTime: 0,
          muscleGroup: 'Back',
          equipment: 'Yoga mat'
        }
      ]
    ];

    const template = exerciseTemplates[dayOfWeek] || exerciseTemplates[0];
    
    return template.map((exercise, index) => ({
      id: `ex-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      ...exercise,
      completed: false,
      targetReps: exercise.reps,
      completedReps: 0
    }));
  }

  private getChallengeDescription(dayOfWeek: number, category: string): string {
    const descriptions = [
      'Start your week with a balanced full-body workout to build overall strength.',
      'Build upper body strength and definition with focused pushing and pulling movements.',
      'Boost your cardiovascular endurance with high-energy interval training.',
      'Strengthen your foundation with intense lower body compound movements.',
      'Mixed modality workout combining strength, cardio, and core exercises.',
      'High-intensity cardio session to burn calories and improve stamina.',
      'Recovery-focused session with stretching and mobility work.'
    ];
    
    return descriptions[dayOfWeek] || 'Daily fitness challenge to keep you active and healthy.';
  }

  // Mark exercise as completed
  markExerciseComplete(challengeId: string, exerciseId: string, completedReps?: number): Observable<boolean> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(false);

    const challengeRef = doc(this.firestore, 'dailyChallenges', challengeId);
    
    return from(getDoc(challengeRef)).pipe(
      switchMap(snapshot => {
        if (!snapshot.exists()) return of(false);
        
        const challenge = snapshot.data() as DailyChallenge;
        const updatedExercises = challenge.exercises.map(exercise => {
          if (exercise.id === exerciseId) {
            return {
              ...exercise,
              completed: true,
              completedReps: completedReps || exercise.reps
            };
          }
          return exercise;
        });
        
        const allCompleted = updatedExercises.every(ex => ex.completed);
        
        const updateData: any = { 
          exercises: updatedExercises 
        };
        
        if (allCompleted) {
          updateData.completed = true;
          updateData.completedAt = Timestamp.now();
        }
        
        return from(updateDoc(challengeRef, updateData)).pipe(
          map(() => true),
          tap(() => {
            // Update local state
            const updatedChallenge = {
              ...challenge,
              ...updateData
            };
            
            if (challengeId === this.todaysChallengeSubject.value?.id) {
              this.todaysChallengeSubject.next(updatedChallenge);
            }
            
            const currentChallenges = this.dailyChallengesSubject.value;
            const updatedChallenges = currentChallenges.map(ch => 
              ch.id === challengeId ? updatedChallenge : ch
            );
            this.dailyChallengesSubject.next(updatedChallenges);
          })
        );
      }),
      catchError(error => {
        console.error('Error marking exercise complete:', error);
        return of(false);
      })
    );
  }

  // Get user's challenge history
  getUserChallengeHistory(limit: number = 30): Observable<DailyChallenge[]> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of([]);

    const challengesRef = collection(this.firestore, 'dailyChallenges');
    const q = query(
      challengesRef,
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => 
        snapshot.docs
          .slice(0, limit)
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as DailyChallenge))
      ),
      tap(challenges => {
        this.dailyChallengesSubject.next(challenges);
      }),
      catchError(error => {
        console.error('Error getting challenge history:', error);
        return of([]);
      })
    );
  }

  // Check if today's challenge is completed
  hasCompletedTodaysChallenge(): Observable<boolean> {
    return this.todaysChallenge$.pipe(
      take(1),
      map(challenge => challenge?.completed || false)
    );
  }

  // Get challenge streak
  getChallengeStreak(): Observable<number> {
    return this.getUserChallengeHistory().pipe(
      map(challenges => {
        const completedChallenges = challenges
          .filter(challenge => challenge.completed)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        if (completedChallenges.length === 0) return 0;
        
        let streak = 0;
        const today = new Date();
        const todayKey = this.getDateKey(today);
        
        // Check if today is completed
        if (completedChallenges[0].date === todayKey) {
          streak = 1;
          
          let checkDate = new Date(today);
          for (let i = 1; i < completedChallenges.length; i++) {
            checkDate.setDate(checkDate.getDate() - 1);
            const checkDateKey = this.getDateKey(checkDate);
            
            if (completedChallenges[i].date === checkDateKey) {
              streak++;
            } else {
              break;
            }
          }
        }
        
        return streak;
      })
    );
  }

  // Generate default challenge (for when user is not logged in)
  private generateDefaultChallenge(dateKey: string, dayOfWeek: number): Observable<DailyChallenge> {
    const defaultChallenge: DailyChallenge = {
      id: 'default-challenge',
      date: dateKey,
      dayOfWeek: dayOfWeek,
      title: 'Daily Fitness Challenge',
      description: 'Complete these exercises to stay active and build consistency.',
      difficulty: 'Intermediate',
      category: 'Mixed',
      exercises: [
        {
          id: 'ex1',
          name: 'Push-ups',
          description: 'Standard push-ups, modify as needed',
          reps: 15,
          sets: 3,
          restTime: 60,
          completed: false,
          muscleGroup: 'Chest',
          targetReps: 15,
          completedReps: 0
        },
        {
          id: 'ex2',
          name: 'Bodyweight Squats',
          description: 'Stand with feet shoulder-width apart',
          reps: 20,
          sets: 3,
          restTime: 60,
          completed: false,
          muscleGroup: 'Legs',
          targetReps: 20,
          completedReps: 0
        },
        {
          id: 'ex3',
          name: 'Plank',
          description: 'Hold for 30-60 seconds',
          reps: 1,
          sets: 3,
          restTime: 45,
          completed: false,
          muscleGroup: 'Core',
          targetReps: 1,
          completedReps: 0
        }
      ],
      completed: false,
      createdAt: Timestamp.now()
    };
    
    this.todaysChallengeSubject.next(defaultChallenge);
    return of(defaultChallenge);
  }

  // Force refresh today's challenge
  refreshTodaysChallenge(): Observable<DailyChallenge> {
    const userId = this.auth.currentUser?.uid;
    const todayKey = this.getDateKey(new Date());
    const dayOfWeek = new Date().getDay();
    
    if (!userId) {
      return this.generateDefaultChallenge(todayKey, dayOfWeek);
    }

    // First delete any existing challenge for today
    const challengesRef = collection(this.firestore, 'dailyChallenges');
    const q = query(
      challengesRef,
      where('userId', '==', userId),
      where('date', '==', todayKey)
    );

    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        
        return from(Promise.all(deletePromises)).pipe(
          switchMap(() => {
            // Clear cache
            this.todaysChallengeSubject.next(null);
            
            // Create new challenge
            return this.createDailyChallenge(todayKey, dayOfWeek, userId);
          })
        );
      }),
      catchError(error => {
        console.error('Error refreshing challenge:', error);
        return this.generateDefaultChallenge(todayKey, dayOfWeek);
      })
    );
  }

  // Complete entire challenge
  completeChallenge(challengeId: string, completionTime: number): Observable<boolean> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(false);

    const challengeRef = doc(this.firestore, 'dailyChallenges', challengeId);
    
    const updateData = {
      completed: true,
      completedAt: Timestamp.now(),
      completionTime: completionTime,
      exercises: this.todaysChallengeSubject.value?.exercises.map(ex => ({
        ...ex,
        completed: true,
        completedReps: ex.completedReps || ex.reps
      }))
    };

    return from(updateDoc(challengeRef, updateData)).pipe(
      map(() => true),
      tap(() => {
        // Update local state
        const updatedChallenge = {
          ...this.todaysChallengeSubject.value!,
          ...updateData,
          exercises: updateData.exercises || this.todaysChallengeSubject.value?.exercises || []
        } as DailyChallenge;
        this.todaysChallengeSubject.next(updatedChallenge);
      }),
      catchError(error => {
        console.error('Error completing challenge:', error);
        return of(false);
      })
    );
  }

  // Get challenge statistics
  getChallengeStats(): Observable<{
    totalCompleted: number;
    currentStreak: number;
    longestStreak: number;
    favoriteCategory: string;
    totalExercises: number;
  }> {
    return this.getUserChallengeHistory().pipe(
      map(challenges => {
        const completed = challenges.filter(c => c.completed);
        const totalCompleted = completed.length;
        
        // Calculate streaks
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        
        const sortedByDate = [...challenges]
          .filter(c => c.completed)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        if (sortedByDate.length > 0) {
          const today = new Date();
          const todayKey = this.getDateKey(today);
          let expectedDate = todayKey;
          
          for (const challenge of sortedByDate) {
            if (challenge.date === expectedDate) {
              tempStreak++;
              currentStreak = Math.max(currentStreak, tempStreak);
              
              const date = new Date(challenge.date);
              date.setDate(date.getDate() - 1);
              expectedDate = this.getDateKey(date);
            } else {
              longestStreak = Math.max(longestStreak, tempStreak);
              tempStreak = 0;
              break;
            }
          }
          
          longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
        }
        
        // Find favorite category
        const categoryCount: Record<string, number> = {};
        completed.forEach(challenge => {
          categoryCount[challenge.category] = (categoryCount[challenge.category] || 0) + 1;
        });
        
        let favoriteCategory = 'Mixed';
        let maxCount = 0;
        for (const [category, count] of Object.entries(categoryCount)) {
          if (count > maxCount) {
            maxCount = count;
            favoriteCategory = category;
          }
        }
        
        // Count total exercises
        const totalExercises = completed.reduce((sum, challenge) => 
          sum + challenge.exercises.length, 0
        );
        
        return {
          totalCompleted,
          currentStreak,
          longestStreak,
          favoriteCategory,
          totalExercises
        };
      }),
      catchError(error => {
        console.error('Error getting challenge stats:', error);
        return of({
          totalCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
          favoriteCategory: 'Mixed',
          totalExercises: 0
        });
      })
    );
  }

  // Clean up on service destruction
  ngOnDestroy() {
    if (this.dateCheckInterval) {
      clearInterval(this.dateCheckInterval);
    }
  }
}