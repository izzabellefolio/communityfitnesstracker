import { Component, OnInit, OnDestroy } from '@angular/core';
import { Auth, AppUser } from '../../core/services/auth';
import { Observable, of, Subscription, lastValueFrom } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { RoutineService } from '../../core/services/routine.service';
import { ChallengeService } from '../../core/services/challenge.service';
import { ChallengeModel } from '../../shared/models/challenge.model';
import { Routine } from '../../shared/models';
import { StreakService } from '../../core/services/streak.service';
import { ProgressService } from '../../core/services/progress.service';
import { UserService } from '../../core/services/user.service';
import { switchMap, take, map, filter } from 'rxjs/operators';
import { UserMetrics } from '../../shared/models';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

export interface Testimonial {
  text: string;
  name: string;
  age: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('100ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('100ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class Home implements OnInit, OnDestroy {
  user$!: Observable<AppUser | null>;
  private userSubscription!: Subscription;
  private metricsSubscription!: Subscription;

  // existing
  routines$: Observable<Routine[]> = of([]);
  todayRoutine: Routine | null = null;
  consistency: number = 0;
  userId: string = '';
  loadingStreak: boolean = true;
  isLoading = true;
  dailyChallenge: any = null;

  // new / dashboard observables
  todayRoutine$!: Observable<Routine | null>;
  streakData$!: Observable<any>;
  dailyChallenge$!: Observable<any>;
  weeklyChallenge$!: Observable<any>;

  // hold loaded user metrics
  userMetrics: UserMetrics | null = null;

  testimonials: Testimonial[] = [
    { text: 'This tracker helped me stay consistent for the first time ever.', name: 'Alex', age: 22 },
    { text: 'The challenges keep me motivated, especially with friends around.', name: 'Sam', age: 19 },
    { text: 'A super clean and simple way to stay active every day.', name: 'Jamie', age: 24 }
  ];

  // --- modal & form ---
  editModalOpen = false;
  metricsForm!: FormGroup;
  saveLoading = false;
  saveError: string | null = null;
  bmi: number | null = null;

  constructor(
    private auth: Auth,
    private router: Router,
    private routineService: RoutineService,
    private challengeService: ChallengeService,
    private streakService: StreakService,
    private progressService: ProgressService,
    public userService: UserService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    console.log('Home component initializing...');

    // 1. Get user observable
    this.user$ = this.auth.user$;

    // prepare form
    this.metricsForm = this.fb.group({
      weight: [null, [Validators.required, Validators.min(20), Validators.max(500)]],
      height: [null, [Validators.required, Validators.min(100), Validators.max(250)]],
      metabolism: ['medium', Validators.required],
      gender: ['other']
    });

    this.metricsForm.valueChanges.subscribe(() => this.computeBMI());

    // 2. Subscribe to user changes to load metrics
    this.userSubscription = this.user$.subscribe({
      next: (user) => {
        console.log('User state changed:', user?.uid || 'No user');
        if (user) {
          this.userId = user.uid;
          this.loadUserMetrics(user.uid);
          this.loadDashboardData(user.uid);
        } else {
          // Reset metrics when user logs out
          this.userMetrics = null;
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error in user subscription:', err);
        this.isLoading = false;
      }
    });

    // 3. Subscribe to UserService metrics changes
    this.metricsSubscription = this.userService.userMetrics$.subscribe({
      next: (metrics) => {
        console.log('UserService metrics updated:', metrics);
        this.userMetrics = metrics;
      },
      error: (err) => {
        console.error('Error in metrics subscription:', err);
      }
    });

    // 4. Initialize streak data
    this.streakData$ = this.user$.pipe(
      filter(user => !!user),
      switchMap(user => {
        if (!user) return of({ current: 0, longest: 0, weeklyConsistency: 0 });
        return this.streakService.getUserStreak(user.uid).pipe(
          map((data: any) => ({
            current: data?.current_streak ?? 0,
            longest: data?.longest_streak ?? 0,
            weeklyConsistency: data?.completed_days 
              ? Math.round((data.completed_days.length / 7) * 100) 
              : 0
          }))
        );
      })
    );
  }

  private loadUserMetrics(userId: string): void {
    console.log('Loading user metrics for:', userId);

    this.progressService.getUserMetrics(userId).pipe(
      take(1)
    ).subscribe({
      next: (metrics) => {
        console.log('Metrics loaded from Firestore:', metrics);
        if (metrics) {
          // Update UserService with Firestore data
          this.userService.setMetrics(metrics);
        } else {
          console.log('No metrics found in Firestore, using UserService defaults');
          // If no metrics in Firestore, ensure UserService has at least default values
          const defaultMetrics = this.userService.getMetricsSnapshot();
          if (defaultMetrics.userId !== userId) {
            // Update default metrics with current userId
            this.userService.setMetrics({
              ...defaultMetrics,
              userId: userId
            });
          }
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading user metrics:', err);
        this.isLoading = false;
      }
    });
  }

  private loadDashboardData(userId: string): void {
    // Load routines
    this.routineService.getUserRoutines().subscribe({
      next: (routines: Routine[]) => {
        this.routines$ = of(routines);
        this.todayRoutine = this.getTodaysRoutine(routines);
      },
      error: (err) => console.error('Error fetching routines:', err)
    });

    // Load daily challenge
    this.challengeService.getDailyChallengeOfTheDay().subscribe({
      next: (challenge) => {
        this.dailyChallenge = challenge;
      },
      error: (err) => console.error('Error fetching daily challenge:', err)
    });

    // Setup observables for template
    this.todayRoutine$ = this.routineService.getTodayRoutine(userId).pipe(
      map((arr: Routine[]) => (arr && arr.length ? arr[0] : null))
    );

    this.dailyChallenge$ = this.challengeService.getDailyChallengeOfTheDay();
    this.weeklyChallenge$ = this.challengeService.getWeeklyChallengeOfTheWeek();
  }

  // Determine today's routine
  getTodaysRoutine(routines: Routine[]): Routine | null {
    const todayIndex = new Date().getDay();
    const dayMap = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const routineToday = routines.find(r => r.schedule?.includes?.(dayMap[todayIndex]));
    return routineToday || (routines.length > 0 ? routines[0] : null);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.metricsSubscription) {
      this.metricsSubscription.unsubscribe();
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  scrollToFirstButton() {
    const target = document.getElementById("firstStartBtn");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("shadow-lg", "border", "border-warning", "bg-warning-subtle", "highlight");
      setTimeout(() => {
        target.classList.remove("shadow-lg", "border", "border-warning", "bg-warning-subtle", "highlight");
      }, 1500);
    }
  }

  // --- Modal / form helpers ---

  openEditMetrics(): void {
    const snap = (this.userService.getMetricsSnapshot && this.userService.getMetricsSnapshot()) || this.userMetrics;
    const values = snap || { weight: null, height: null, metabolism: 'medium', gender: 'other' } as any;
    this.metricsForm.patchValue({
      weight: values.weight || null,
      height: values.height || null,
      metabolism: values.metabolism || 'medium',
      gender: values.gender || 'other'
    });
    this.computeBMI();
    this.editModalOpen = true;
    document.body.classList.add('modal-open');
  }

  closeEditMetrics(): void {
    this.editModalOpen = false;
    document.body.classList.remove('modal-open');
    this.saveError = null;
  }

  private computeBMI(): void {
    const w = this.metricsForm.get('weight')!.value;
    const h = this.metricsForm.get('height')!.value;
    if (w && h) {
      const hh = h / 100;
      this.bmi = Number((w / (hh * hh)).toFixed(1));
    } else {
      this.bmi = null;
    }
  }

  async saveMetrics(): Promise<void> {
    if (!this.metricsForm) return;
    if (this.metricsForm.invalid) {
      this.metricsForm.markAllAsTouched();
      return;
    }
    this.saveLoading = true;
    this.saveError = null;
    const vals = this.metricsForm.value;

    try {
      if (!this.userId) throw new Error('User not available');
      // persist metrics (returns a Promise)
      await this.progressService.saveUserMetrics(this.userId, {
        weight: vals.weight,
        height: vals.height,
        metabolism: vals.metabolism,
        gender: vals.gender
      });

      // update canonical weight used by stats$ — best-effort
      try {
        await lastValueFrom(this.progressService.updateWeight(vals.weight));
      } catch (e) {
        console.warn('updateWeight failed (non-fatal):', e);
      }

      // ensure client-side UserService has the latest values for immediate UI update
      this.userService.setMetrics({
        userId: this.userId,
        weight: vals.weight,
        height: vals.height,
        metabolism: vals.metabolism,
        gender: vals.gender,
        bmi: this.bmi ?? 0,
        lastUpdated: new Date()
      } as any);

      this.closeEditMetrics();
    } catch (err: any) {
      console.error('Could not save metrics:', err);
      this.saveError = err?.message || 'Could not save metrics';
    } finally {
      this.saveLoading = false;
    }
  }
}