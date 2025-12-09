import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ChallengeService } from '../../../core/services/challenge.service';
import { ChallengeCard } from '../challenge-card/challenge-card';
import { CommonModule } from '@angular/common';
import { ChallengeModel, UserChallenge } from '../../../shared/models/challenge.model';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { Auth, authState } from '@angular/fire/auth';

@Component({
  selector: 'app-challenge-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ChallengeCard],
  templateUrl: './challenge-list.html',
  styleUrls: ['./challenge-list.css']
})
export class ChallengeList implements OnInit {
  private challengeService = inject(ChallengeService);
  private leaderboardService = inject(LeaderboardService);
  private auth = inject(Auth);

  // lists
  dailyChallenges: ChallengeModel[] = [];   // assigned 3 daily
  weeklyChallenges: ChallengeModel[] = [];  // public list + ensure user weekly set is included
  completedChallenges: UserChallenge[] = [];
  totalPoints = 0;
  loading = true;

  ngOnInit(): void {
    this.loadAllData();
  }

  public loadAllData() {
    this.loading = true;

    // load public weekly list (visible to guests)
    this.challengeService.getPublicWeeklyChallenges().subscribe({
      next: list => {
        this.weeklyChallenges = list || [];
      },
      error: err => {
        console.error('Error loading weekly challenges list:', err);
        this.weeklyChallenges = [];
      }
    });

    // wait for auth state then load user-specific sets
    authState(this.auth).subscribe(user => {
      if (!user) {
        this.loading = false;
        this.dailyChallenges = [];
        this.completedChallenges = [];
        this.totalPoints = 0;
        return;
      }

      // user's completed challenges -> compute total points locally
      this.challengeService.getUserCompletedChallenges().subscribe({
        next: challenges => {
          this.completedChallenges = challenges || [];
          this.totalPoints = this.completedChallenges.reduce((s, c) => s + (c.points || 0), 0);
        },
        error: err => {
          console.error('Error loading completed challenges:', err);
          this.completedChallenges = [];
          this.totalPoints = 0;
          this.loading = false;
        }
      });

      // optionally keep leaderboard-backed authoritative points
      const uid = this.auth.currentUser?.uid;
      if (uid) {
        this.leaderboardService.getUserTotalPoints(uid).subscribe({
          next: p => { this.totalPoints = p; },
          error: () => { /* ignore */ }
        });
      }

      // Get the 3 persistent daily challenges for this user
      this.challengeService.getDailyChallengesOfTheDay().subscribe({
        next: arr => {
          this.dailyChallenges = arr ?? [];
        },
        error: err => console.error('Error loading daily challenges set:', err)
      });

      // Get the 7 persistent weekly challenges for this user and ensure they appear in list
      this.challengeService.getWeeklyChallengesOfTheWeek().subscribe({
        next: arr => {
          const assigned = arr ?? [];
          if (assigned.length) {
            // show only the user's assigned weekly set (keeps it stable for the week)
            this.weeklyChallenges = assigned;
          }
        },
        error: err => console.error('Error loading weekly challenges set:', err),
        complete: () => { this.loading = false; }
      });
    });
  }

  // When called after completing a challenge, refresh completed list and points
  loadCompletedChallenges() {
    this.challengeService.getUserCompletedChallenges().subscribe({
      next: (challenges) => {
        this.completedChallenges = challenges;
        this.totalPoints = challenges.reduce((sum, c) => sum + c.points, 0);
      },
      error: (error) => {
        console.error('Error loading completed challenges:', error);
        this.completedChallenges = [];
        this.totalPoints = 0;
      }
    });
  }

  // keep the old helper in case used elsewhere
  loadTotalPoints() {
    this.challengeService.getUserTotalPoints().subscribe({
      next: (points) => {
        this.totalPoints = points;
      },
      error: (err) => {
        console.error('Error loading points:', err);
      }
    });
  }

  isChallengeCompleted(challengeId: string | number | undefined, challengeType?: string): boolean {
    if (!challengeId) return false;
    const idStr = String(challengeId);

    return this.completedChallenges.some(c => {
      const candidateId = (c as any).challengeId ?? (c as any).challenge_id ?? (c as any).id ?? '';
      if (String(candidateId) !== idStr) return false;

      if (challengeType === 'daily') {
        const ca: any = (c as any).completedAt;
        if (!ca) return false;
        const completedAtDate = ca.toDate ? ca.toDate() : new Date(ca);
        const now = new Date();
        return completedAtDate.getFullYear() === now.getFullYear()
          && completedAtDate.getMonth() === now.getMonth()
          && completedAtDate.getDate() === now.getDate();
      }

      return true;
    });
  }

  completeChallenge(challenge: ChallengeModel) {
    if (!challenge.id) {
      alert('Invalid challenge: missing ID');
      return;
    }

    if (this.isChallengeCompleted(challenge.id, challenge.type)) {
      alert('You have already completed this challenge today!');
      return;
    }
    this.challengeService.completeChallenge(challenge).subscribe({
      next: (res) => {
        alert(`Challenge completed! +${challenge.points} points 🎉`);
        // refresh local data
        this.loadCompletedChallenges();
        this.loadTotalPoints();
      },
      error: (error) => {
        console.error('Error completing challenge:', error);
        alert('Failed to complete challenge');
      }
    });
  }

  // Seed challenges (admin helper)
  async seedChallenges() {
    if (!confirm('This will add challenges to the database. Continue?')) return;
    try {
      await this.challengeService.seedChallenges();
      alert('Challenges seeded successfully!');
      this.loadAllData();
    } catch (error) {
      console.error('Error seeding challenges:', error);
      alert('Failed to seed challenges');
    }
  }
}