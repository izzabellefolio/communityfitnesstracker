import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Auth, AppUser } from '../../../core/services/auth';
import { Observable } from 'rxjs';

interface NavItem {
  path: string;
  title: string;
  icon: string;
  badgeClass?: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
})
export class Navbar implements OnInit {
  isCollapsed: boolean = true;
  isLoading = true;

  // Observable for logged-in user
  user$!: Observable<AppUser | null>;

  // Navigation items
  navItems: NavItem[] = [
    { path: '/challenges', title: 'Challenges', icon: 'bi bi-award' },
    { path: '/leaderboard', title: 'Leaderboard', icon: 'bi bi-people' },
    { path: '/routines', title: 'Routine', icon: 'bi bi-calendar-check'},
    { path: '/progress', title: 'Progress', icon: 'bi-graph-up' },
    { path: '/home', title: 'Home', icon: 'bi bi-house' }
  ];

  constructor(private router: Router, public authservice: Auth) {}

  ngOnInit(): void {
    this.user$ = this.authservice.user$;
  }

  navigateTo(path: string): void {
    this.router.navigateByUrl(path);
    this.isCollapsed = true; // Collapse navbar on mobile after navigation
  }

  isActiveRoute(path: string): boolean {
    return this.router.url === path;
  }

  logout(): void {
    this.authservice.logout(); 
    this.router.navigate(['/login']);
  }
}
