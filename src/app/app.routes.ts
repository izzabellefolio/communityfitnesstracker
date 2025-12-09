import { Routes } from '@angular/router';

import { Home } from './features/home/home';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { RoutineList } from './features/routine/routine-list/routine-list';
import { RoutineCreate } from './features/routine/routine-create/routine-create';
import { RoutineDetail } from './features/routine/routine-detail/routine-detail';
import { PremadeRoutines } from './features/routine/premade-routines/premade-routines';
import { ProgressDashboard } from './features/progress/progress-dashboard/progress-dashboard';
import { ChallengeList } from './features/challenge/challenge-list/challenge-list';
import { LeaderboardComponent } from './features/leaderboard/leaderboard/leaderboard';

// Auth guard
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  // Public routes
  { path: '', component: Home },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'register', component: Register },

  // Protected routes (require authentication)
  {
    path: 'routines',
    component: RoutineList
  },
  {
    path: 'routines/create',
    component: RoutineCreate
  },
  {
    path: 'routines/premade',
    component: PremadeRoutines
  },
  {
    path: 'routines/:id',
    component: RoutineDetail
  },
  {
    path: 'progress',
    component: ProgressDashboard
  },

  // Challenges (protected)
  {
    path: 'challenges',
    component: ChallengeList
  },
  {
    path: 'challenges/history',
    component: ChallengeList
  },
  {
    path: 'challenges/:id',
    component: ChallengeList
  },

  {
    path: 'leaderboard',
    component: LeaderboardComponent
  },

  // Wildcard route
  { path: '**', redirectTo: '' }
];