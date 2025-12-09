import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, switchMap, of, map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { StreakService } from '../../../core/services/streak.service';
import { UserStats } from '../../models';
import { ProgressService } from '../../../core/services/progress.service';

interface NavItem {
  title: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class Navbar{
  isCollapsed = true;
  user$!: Observable<any>;
  streak$!: Observable<any>;

  navItems: NavItem[] = [
    { title: 'Challenges', path: '/challenges', icon: 'bi bi-clock' },
    { title: 'Leaderboard', path: '/leaderboard', icon: 'bi bi-award' },
    { title: 'Routine',  path: '/routines',  icon: 'bi bi-activity' },
    { title: 'Progress',  path: '/progress',  icon: 'bi bi-graph-up' },
    { title: 'Home',   path: '',   icon: 'bi bi-house-door' },
  ];

  showRegister = true; // set false if you don't have a register page

  constructor(
  private auth: Auth,
  private router: Router,
  private streakService: StreakService, // you can keep this if used elsewhere
  private progressService: ProgressService // <-- new injection
) {
  this.user$ = authState(this.auth);

  // Ensure progress stats are fetched when a user is signed in so stats$ emits
  authState(this.auth).subscribe(user => {
    if (user) {
      this.progressService.getUserStats().subscribe({
        next: () => { /* stats$ BehaviorSubject now populated */ },
        error: () => { /* ignore errors here */ }
      });
    }
  });

  // Stream streak from ProgressService.stats$ (same source used by dashboard)
  this.streak$ = authState(this.auth).pipe(
    switchMap(user => user ? this.progressService.stats$ : of(null)),
    map(stats => stats ? stats.streak : 0)
  );
}

  isActiveRoute(path: string): boolean {
    return this.router.url === path;
  }

  collapseIfMobile() {
    if (window.innerWidth < 992) {
      this.isCollapsed = true;
    }
  }

  async logout() {
    await this.auth.signOut();
    this.router.navigate(['/home']);
  }
}