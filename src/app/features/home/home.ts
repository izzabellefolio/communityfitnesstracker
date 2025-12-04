import { Component, OnInit } from '@angular/core';
import { Auth, AppUser } from '../../core/services/auth';
import { Observable, of } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { RoutineService } from '../routine/routine';
import { ChallengeService } from '../challenge/challenge';
import { ChallengeModel } from '../../shared/models/challenge.model';
import { Routine } from '../../shared/models';

interface Testimonial {
  text: string;
  name: string;
  age: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('500ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('500ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class Home implements OnInit {
  user$!: Observable<AppUser | null>;
  routines$: Observable<Routine[]> = of([]);
  todayRoutine: Routine | null = null;
  currentStreak = 0;
  isLoading = true;
  dailyChallenge: any = null;

  testimonials: Testimonial[] = [
    { text: 'This tracker helped me stay consistent for the first time ever.', name: 'Alex', age: 22 },
    { text: 'The challenges keep me motivated, especially with friends around.', name: 'Sam', age: 19 },
    { text: 'A super clean and simple way to stay active every day.', name: 'Jamie', age: 24 }
  ];

  constructor(
    private auth: Auth,
    private router: Router,
    private routineService: RoutineService,
    private challengeService: ChallengeService
  ) {}

  ngOnInit(): void {
    this.user$ = this.auth.user$;

    // Subscribe to routines in real-time
    this.routineService.getUserRoutines().subscribe({
      next: (routines: Routine[]) => {
        this.routines$ = of(routines);
        this.todayRoutine = this.getTodaysRoutine(routines);
        this.currentStreak = this.calculateStreak(routines);
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error fetching routines:', err);
        this.isLoading = false;
      }
    });

    // Load daily challenge once
    this.challengeService.getTodaysChallenge().subscribe({
      next: (challenge) => this.dailyChallenge = challenge,
      error: (err: any) => console.error('Error fetching daily challenge:', err)
    });
  }

  // Determine today's routine
  getTodaysRoutine(routines: Routine[]): Routine | null {
    const todayIndex = new Date().getDay(); // 0 = Sunday
    const dayMap = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const routineToday = routines.find(r => r.schedule.includes(dayMap[todayIndex]));
    return routineToday || (routines.length > 0 ? routines[0] : null);
  }

  // Calculate streak based on completedDates
  calculateStreak(routines: Routine[]): number {
  const allCompleted: string[] = routines
    .flatMap(r => r.completedDates || [])
    .map(dateStr => {
      // Normalize dates to YYYY-MM-DD format (remove time component)
      const d = new Date(dateStr);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0];
    })
    .filter((date, index, self) => self.indexOf(date) === index) // Remove duplicates
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Sort newest first

  if (allCompleted.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Streak must start from today or yesterday
  if (allCompleted[0] !== todayStr && allCompleted[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  let expectedDate = new Date(allCompleted[0]);

  for (const dateStr of allCompleted) {
    const currentDate = new Date(dateStr);
    
    if (currentDate.getTime() === expectedDate.getTime()) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1); // Move to previous day
    } else {
      break; // Streak is broken
    }
  }

  return streak;
}

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  scrollToFirstButton() {
      const target = document.getElementById("firstStartBtn");

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });

        target.classList.add("shadow-lg", "border", "border-warning", "bg-warning-subtle");

        // highlight effect
        target.classList.add("highlight");
        setTimeout(() => {
          target.classList.remove("shadow-lg", "border", "border-warning", "bg-warning-subtle");
        }, 1500);
      }
  }
}