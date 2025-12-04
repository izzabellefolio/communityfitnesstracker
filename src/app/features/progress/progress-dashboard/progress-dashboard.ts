import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StatsCard } from '../stats-card/stats-card';
import { WorkoutLog } from '../workout-log/workout-log';
import { ProgressChart } from '../progress-chart/progress-chart';
import { ProgressService } from '../progress';
import { UserStats } from '../../../shared/models/workout-log.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-progress-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StatsCard, WorkoutLog, ProgressChart],
  templateUrl: './progress-dashboard.html',
  styleUrls: ['./progress-dashboard.css'],
})
export class ProgressDashboard implements OnInit {
  private progressService = inject(ProgressService);
  Math = Math; // expose Math to template

  stats$!: Observable<UserStats>;
  currentWeight = 70;
  newWeight = 70;
  loading = true;
  showWeightUpdate = false;
  lastUpdated?: Date;

  // NEW: computed streak from logs (use this in template instead of raw stats streak)
  streakComputed = 0;
  totalStreak = 0; // NEW cumulative streak


  // NEW: today's totals (derived from logs)
  todayWorkouts = 0;
  todayReps = 0;
  todayCalories = 0;

  ngOnInit() {
    this.stats$ = this.progressService.stats$;

    this.stats$.subscribe(stats => {
      this.currentWeight = stats.currentWeight ?? 70;
      this.newWeight = stats.currentWeight ?? 70;
      this.loading = false;

      const reported = (stats as any).streak ?? (stats as any).currentStreak ?? 0;
      if (reported) console.debug('[ProgressDashboard] reported streak from stats:', reported);
    });

    this.progressService.getUserStats().subscribe();

    // Subscribe to logs and compute streak + today's totals locally
    this.progressService.getUserWorkoutLogs().subscribe({
      next: logs => {
        try {
          const computed = this.computeStreakFromLogs(logs || []);
          if (computed !== this.streakComputed) {
            console.debug('[ProgressDashboard] computed streak from logs:', computed, 'previous:', this.streakComputed);
            this.streakComputed = computed;
          }

          const uniqueDays = new Set<string>();
          for (const log of logs || []) {
            const d = new Date(log.date);
            if (!isNaN(d.getTime())) {
              uniqueDays.add(this.toLocalYMD(d));
            }
          }
          this.totalStreak = uniqueDays.size;

          // compute today's totals (local date)
          const todayKey = this.toLocalYMD(new Date());
          let w = 0, r = 0, c = 0;
          const seenWorkoutsForToday = new Set<string>(); // optional dedupe by id if logs include duplicates
          for (const log of (logs || [])) {
            const ld = new Date(log.date);
            if (isNaN(ld.getTime())) continue;
            const key = this.toLocalYMD(ld);
            if (key !== todayKey) continue;
            // avoid double-counting same doc if present
            const id = (log.id || JSON.stringify(log));
            if (seenWorkoutsForToday.has(id)) continue;
            seenWorkoutsForToday.add(id);
            w += 1;
            r += (log.totalReps || 0);
            c += (log.caloriesBurned || 0);
          }
          this.todayWorkouts = w;
          this.todayReps = r;
          this.todayCalories = c;

        } catch (err) {
          console.error('[ProgressDashboard] error computing streak/totals from logs:', err);
        }
      },
      error: err => {
        console.error('[ProgressDashboard] failed to load logs for streak/totals computation:', err);
      }
    });
  }

  updateWeight() {
    if (this.newWeight <= 0) {
      alert('Please enter a valid weight');
      return;
    }

    this.progressService.updateWeight(this.newWeight).subscribe({
      next: () => {
        this.showWeightUpdate = false;
        alert('Weight updated successfully!');
      },
      error: error => {
        console.error('Error updating weight:', error);
        alert('Failed to update weight');
      }
    });
  }

  // NEW helper: normalize a Date to local YYYY-MM-DD
  private toLocalYMD(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Helper: compute streak anchored on today
  private computeStreakFromLogs(logs: any[]): number {
    if (!logs || logs.length === 0) return 0;

    // Build set of unique local date strings
    const days = new Set<string>();
    for (const log of logs) {
      const date = new Date(log.date);
      if (isNaN(date.getTime())) continue;
      days.add(this.toLocalYMD(date));
    }
    if (days.size === 0) return 0;

    // Anchor on today
    let streak = 0;
    let cursor = new Date();
    while (true) {
      const key = this.toLocalYMD(cursor);
      if (!days.has(key)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }
}
