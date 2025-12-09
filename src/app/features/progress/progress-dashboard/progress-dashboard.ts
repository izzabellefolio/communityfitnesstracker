import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StatsCard } from '../stats-card/stats-card';
import { WorkoutLog } from '../workout-log/workout-log';
import { ProgressService } from '../../../core/services/progress.service';
import { UserStats } from '../../../shared/models/workout-log.model';
import { Observable, of, Subscription } from 'rxjs';
import { Chart, ChartConfiguration } from 'chart.js';
import { Auth, authState } from '@angular/fire/auth';
import 'chart.js/auto';

@Component({
  selector: 'app-progress-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StatsCard, WorkoutLog],
  templateUrl: './progress-dashboard.html',
  styleUrls: ['./progress-dashboard.css'],
})
export class ProgressDashboard implements OnInit, AfterViewInit, OnDestroy {
  public progressService = inject(ProgressService);
  private auth = inject(Auth);
  private subs: Subscription[] = [];

  public registeredWeight: number | null = null;
  Math = Math;

  stats$!: Observable<UserStats>;
  currentWeight = 70;
  newWeight = 70;
  loading = true;
  showWeightUpdate = false;

  // charts & data
  dailyProgress: any[] = []; // array of DailyProgress entries (date, caloriesBurned, workoutsCompleted, totalReps)
  recentWorkouts: any[] = []; // mapped workout logs for display
  improvementStatus: 'improving' | 'maintaining' | 'regressing' = 'maintaining';
  improvementScore = 0; // numeric convenience (0..100)
  isLoadingCharts = true;

  // range toggle (7 / 14 / 30 days)
  rangeDays = 7;

  private caloriesChartInstance?: Chart;
  private repsChartInstance?: Chart;
  private intensityChartInstance?: Chart;
  private weightChartInstance?: Chart;

  @ViewChild('caloriesChart', { static: false }) caloriesChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('repsChart', { static: false }) repsChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('intensityChart', { static: false }) intensityChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('weightChart', { static: false }) weightChart!: ElementRef<HTMLCanvasElement>;

  // derived stats
  caloriesToday = 0;
  totalCaloriesBurned = 0;
  totalRepsCompleted = 0;
  averageIntensity = 0; // 1..10
  weeklyConsistencyPercent = 0;
  bmi = 0;
  weightHistory: { date: Date; weight: number; bmi?: number }[] = [];

  ngOnInit() {
    this.stats$ = this.progressService.stats$;

    // subscribe to persisted stats
    this.subs.push(this.stats$.subscribe(stats => {
      this.currentWeight = stats.currentWeight ?? 70;
      this.newWeight = stats.currentWeight ?? 70;
      this.totalRepsCompleted = stats.totalReps ?? 0;
      this.totalCaloriesBurned = stats.caloriesBurned ?? 0;
      this.loading = false;
    }));

    // initial fetches
    this.subs.push(this.progressService.getUserStats().subscribe());

    // Subscribe to auth state — handle the case where `auth.currentUser` is not ready yet.
    this.subs.push(authState(this.auth).subscribe(user => {
      if (!user) {
        console.warn('[ProgressDashboard] No authenticated user found');
        this.isLoadingCharts = false;
        return;
      }

      const uid = user.uid;

      // load daily progress (we request double-range so we can compute trend comparisons)
      this.loadDailyProgress(this.rangeDays);

      // load recent workouts and map exercises
      this.subs.push(this.progressService.getUserWorkoutLogs().subscribe({
        next: (workouts) => {
          const mapped = (workouts || []).map(w => this.mapWorkoutLog(w));
          this.recentWorkouts = mapped.slice(0, 20); // keep a few
          // derive avg intensity
          const intensities = mapped.map(m => m.intensity || 0).filter(v => v > 0);
          this.averageIntensity = intensities.length ? Math.round(intensities.reduce((a, b) => a + b, 0) / intensities.length) : 0;
          this.calculateImprovement(); // recalc whenever workouts update
        },
        error: (err) => {
          console.error('[ProgressDashboard] Error loading workout history:', err);
        }
      }));

      // load user metrics (weight / height history) for BMI and weight trend chart
      this.subs.push(this.progressService.getUserMetrics(uid).subscribe(metrics => {
        if (!metrics) return;
        this.registeredWeight = metrics.weight ?? null;
        if (this.registeredWeight && this.registeredWeight > 0) {
          this.currentWeight = this.registeredWeight;
          this.newWeight = this.registeredWeight;
        }
        // BMI and chart history
        this.bmi = metrics.bmi ?? this.calcBMI(this.currentWeight, metrics.height ?? 170);
        this.weightHistory = [{ date: metrics.lastUpdated ? new Date(metrics.lastUpdated) : new Date(), weight: metrics.weight, bmi: metrics.bmi }];

        this.createChartsIfReady();
      }, error => console.error('[ProgressDashboard] getUserMetrics error', error)));
    }));
  }

  ngAfterViewInit() {
    this.createChartsIfReady();
  }

  ngOnDestroy() {
    try {
      this.subs.forEach(s => s.unsubscribe());
    } catch {}
    [this.caloriesChartInstance, this.repsChartInstance, this.intensityChartInstance, this.weightChartInstance].forEach(c => { if (c) c.destroy(); });
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
        this.currentWeight = this.newWeight;
        // optionally save to user metrics collection (if you track history)
      },
      error: error => {
        console.error('Error updating weight:', error);
        alert('Failed to update weight');
      }
    });
  }

  private normalizeDate(date: any): Date {
    if (!date) return new Date();
    return date instanceof Date ? date : date?.toDate ? date.toDate() : new Date(date);
  }

  // Map a raw workout log to UI-friendly shape and compute per-exercise calories and totals
  private mapWorkoutLog(w: any) {
    const date = this.normalizeDate(w.date);
    const exercises = (w.exercises || []).map((ex: any) => {
      // calories heuristic uses same calculateCalories as service (approx)
      const caloriesPerRep = 0.5;
      const caloriesPerMinute = 5;
      const sets = ex.sets || 0;
      const reps = ex.reps || 0;
      const duration = ex.duration || 0; // minutes
      const calories = Math.round((sets * reps * caloriesPerRep) + (duration * caloriesPerMinute));
      return {
        name: ex.name || ex.exerciseName || 'Exercise',
        sets: sets || undefined,
        reps: reps || undefined,
        duration: duration || undefined,
        intensityLabel: ex.intensityLevel || ex.intensity || undefined,
        intensity: typeof ex.intensity === 'number' ? ex.intensity : undefined,
        calories
      };
    });

    const totalCalories = w.caloriesBurned ?? (exercises.reduce((s: number, e: any) => s + (e.calories || 0), 0));
    const totalReps = w.totalReps ?? exercises.reduce((s: number, e: any) => s + ((e.sets || 0) * (e.reps || 0)), 0);
    const intensity = w.intensityScore ?? (exercises.length ? Math.round(exercises.reduce((s: any, e: any) => s + (e.intensity || 5), 0) / exercises.length) : 5);

    return {
      id: w.id,
      date,
      routineName: w.routineName || w.routine || 'Workout Session',
      exercises,
      totalCalories,
      totalReps,
      duration: w.duration ?? 0,
      intensity
    };
  }

  private calculateImprovement() {
    // compute three factor results: calorieTrend, intensityTrend, streakResult
    // We'll request 14 days (or 2x rangeDays) data in loadDailyProgress and keep it in dailyProgress
    if (!this.dailyProgress || this.dailyProgress.length < 2) {
      this.improvementStatus = 'maintaining';
      return;
    }

    // ensure we have at least 2 * rangeDays for comparing previous/current window where possible
    const window = this.rangeDays;
    const dpSortedDesc = [...this.dailyProgress].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    // Calories trend: compare avg of most recent `window` days vs previous `window` days if available
    let calorieTrendStatus: 'improving' | 'maintaining' | 'regressing' = 'maintaining';
    if (dpSortedDesc.length >= window * 2) {
      const recent = dpSortedDesc.slice(0, window);
      const prev = dpSortedDesc.slice(window, window * 2);
      const avgRecent = recent.reduce((s, x) => s + (x.caloriesBurned || 0), 0) / recent.length;
      const avgPrev = prev.reduce((s, x) => s + (x.caloriesBurned || 0), 0) / prev.length;
      const pctChange = avgPrev === 0 ? (avgRecent > 0 ? 100 : 0) : ((avgRecent - avgPrev) / avgPrev) * 100;

      if (pctChange >= 10) calorieTrendStatus = 'improving';
      else if (pctChange <= -10) calorieTrendStatus = 'regressing';
      else calorieTrendStatus = 'maintaining';
    } else {
      // fallback: compute simple trend across available days (first vs last)
      const first = dpSortedDesc[dpSortedDesc.length - 1];
      const last = dpSortedDesc[0];
      const pctChange = first && last && first.caloriesBurned ? ((last.caloriesBurned - first.caloriesBurned) / (first.caloriesBurned)) * 100 : 0;
      calorieTrendStatus = pctChange >= 10 ? 'improving' : pctChange <= -10 ? 'regressing' : 'maintaining';
    }

    // Intensity trend: compare average intensity in last half vs previous half of recent workouts (use recentWorkouts mapped array)
    let intensityTrendStatus: 'improving' | 'maintaining' | 'regressing' = 'maintaining';
    const rw = [...this.recentWorkouts].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    if (rw.length >= 4) {
      const half = Math.floor(rw.length / 2);
      const recentAvg = rw.slice(0, half).reduce((s, w) => s + (w.intensity || 0), 0) / Math.max(1, half);
      const prevAvg = rw.slice(half, half * 2).reduce((s, w) => s + (w.intensity || 0), 0) / Math.max(1, half);
      if (recentAvg > prevAvg) intensityTrendStatus = 'improving';
      else if (recentAvg < prevAvg) intensityTrendStatus = 'regressing';
      else intensityTrendStatus = 'maintaining';
    }

    // Streak consistency: based on last `window` days, count active days
    let streakStatus: 'improving' | 'maintaining' | 'regressing' = 'maintaining';
    const lastNDays = dpSortedDesc.slice(0, window);
    const activeDays = lastNDays.filter(p => (p.workoutsCompleted || 0) > 0).length;
    if (activeDays >= 6) streakStatus = 'improving';
    else if (activeDays >= 4) streakStatus = 'maintaining';
    else streakStatus = 'regressing';

    // Combine: majority vote (2+ same => that), otherwise apply priority: regressing < maintaining < improving
    const results = [calorieTrendStatus, intensityTrendStatus, streakStatus];
    const counts = {
      improving: results.filter(r => r === 'improving').length,
      maintaining: results.filter(r => r === 'maintaining').length,
      regressing: results.filter(r => r === 'regressing').length
    };

    if (counts.improving >= 2) this.improvementStatus = 'improving';
    else if (counts.regressing >= 2) this.improvementStatus = 'regressing';
    else if (counts.maintaining >= 2) this.improvementStatus = 'maintaining';
    else {
      // tie-breaker: if any regressing -> regressing, else if any improving -> improving, else maintaining
      if (counts.regressing > 0) this.improvementStatus = 'regressing';
      else if (counts.improving > 0) this.improvementStatus = 'improving';
      else this.improvementStatus = 'maintaining';
    }

    // set improvementScore for a linear meter (simple mapping)
    this.improvementScore = (counts.improving * 100 / 3) - (counts.regressing * 100 / 3) + 50; // 0..100 approx
    if (this.improvementScore < 0) this.improvementScore = 0;
    if (this.improvementScore > 100) this.improvementScore = 100;
  }

  // range change by user (7 / 14 / 30 days)
  changeRange(days: number) {
    if (this.rangeDays === days) return;
    this.rangeDays = days;
    this.loadDailyProgress(days);
  }

  private loadDailyProgress(days: number = 7) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      this.dailyProgress = [];
      this.isLoadingCharts = false;
      return;
    }
    // request double window to compute trends (if possible)
    const daysToRequest = Math.max(days * 2, 7);
    const dpSub = this.progressService.getDailyProgressFromLogs(daysToRequest).subscribe({
      next: (data) => {
        // progressService returns most-recent-first; we keep it for convenience
        this.dailyProgress = (data || []).map(p => ({ ...p, date: this.normalizeDate(p.date) }));
        // compute derived numbers
        this.caloriesToday = this.calcCaloriesToday(this.dailyProgress);
        this.totalCaloriesBurned = this.dailyProgress.reduce((s, p) => s + (p.caloriesBurned || 0), 0);
        this.weeklyConsistencyPercent = this.getWeeklyConsistencyFromArray(this.dailyProgress.slice(0, days));
        // recalc improvement & charts
        this.calculateImprovement();
        this.createChartsIfReady();
      },
      error: err => {
        console.error('[ProgressDashboard] loadDailyProgress error', err);
      }
    });
    this.subs.push(dpSub);
  }

  private calcCaloriesToday(arr: any[]): number {
    const todayKey = new Date().toISOString().slice(0, 10);
    const found = (arr || []).find(d => (d.date && (d.date.toISOString().slice(0, 10) === todayKey)));
    return found ? (found.caloriesBurned || 0) : 0;
  }

  private getWeeklyConsistencyFromArray(arr: any[]): number {
    if (!arr || !arr.length) return 0;
    const activeDays = arr.filter(p => (p.workoutsCompleted || 0) > 0).length;
    return Math.round((activeDays / arr.length) * 100);
  }

  private createChartsIfReady() {
    // wait for some data and canvas elements
    if (!this.dailyProgress?.length) return;
    if (!this.caloriesChart?.nativeElement || !this.repsChart?.nativeElement) {
      setTimeout(() => this.createChartsIfReady(), 50);
      return;
    }
    this.createCharts();
  }

  private createCharts() {
    const dp = [...this.dailyProgress].slice(0, this.rangeDays).reverse(); // ascending dates for charts
    const labels = dp.map(p => this.formatDate(p.date));

    // CALORIES chart
    const caloriesConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Calories Burned',
          data: dp.map(p => p.caloriesBurned || 0),
          borderColor: '#4e73df',
          backgroundColor: 'rgba(78, 115, 223, 0.08)',
          tension: 0.35,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    };

    // REPS chart (total reps per day)
    const repsConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Reps',
          data: dp.map(p => (p.totalReps || 0)),
          backgroundColor: '#1cc88a'
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    };

    // INTENSITY chart (use daily average intensity computed from workouts on that day)
    const intensityPerDay = dp.map(d => d.intensity || this.estimateIntensityFromDate(d.date));
    const intensityConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Intensity',
          data: intensityPerDay,
          borderColor: '#fd7e14',
          backgroundColor: 'rgba(253,126,20,0.06)',
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, suggestedMax: 10 } }
      }
    };

    // WEIGHT / BMI chart (multi-series) — uses weightHistory (fallback single point)
    const wh = this.weightHistory && this.weightHistory.length ? this.weightHistory.slice(-this.rangeDays) : [{ date: new Date(), weight: this.currentWeight, bmi: this.bmi }];
    const whSorted = wh.map(h => ({ ...h, date: this.normalizeDate(h.date) })).sort((a, b) => a.date.getTime() - b.date.getTime());
    const weightLabels = whSorted.map(h => h.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const weightSeries = whSorted.map(h => h.weight);
    const bmiSeries = whSorted.map(h => h.bmi ?? this.calcBMI(h.weight, 170 /* unknown height fallback */));

    const weightConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels: weightLabels,
        datasets: [
          { label: 'Weight (kg)', data: weightSeries, borderColor: '#2e59d9', backgroundColor: 'rgba(46,89,217,0.06)', tension: 0.3, yAxisID: 'y' },
          { label: 'BMI', data: bmiSeries, borderColor: '#1cc88a', backgroundColor: 'rgba(28,200,138,0.04)', tension: 0.3, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          y: { type: 'linear', position: 'left', beginAtZero: false },
          y1: { type: 'linear', position: 'right', beginAtZero: false, grid: { drawOnChartArea: false } }
        }
      }
    };

    // destroy existing
    if (this.caloriesChartInstance) this.caloriesChartInstance.destroy();
    if (this.repsChartInstance) this.repsChartInstance.destroy();
    if (this.intensityChartInstance) this.intensityChartInstance.destroy();
    if (this.weightChartInstance) this.weightChartInstance.destroy();

    const ctxC = this.caloriesChart.nativeElement.getContext('2d');
    const ctxR = this.repsChart.nativeElement.getContext('2d');
    const ctxI = this.intensityChart?.nativeElement?.getContext ? this.intensityChart.nativeElement.getContext('2d') : null;
    const ctxW = this.weightChart?.nativeElement?.getContext ? this.weightChart.nativeElement.getContext('2d') : null;

    if (ctxC) this.caloriesChartInstance = new Chart(ctxC, caloriesConfig);
    if (ctxR) this.repsChartInstance = new Chart(ctxR, repsConfig);
    if (ctxI) this.intensityChartInstance = new Chart(ctxI, intensityConfig);
    if (ctxW) this.weightChartInstance = new Chart(ctxW, weightConfig);

    this.isLoadingCharts = false;
  }

  // estimate intensity for a dailyProgress entry by scanning recentWorkouts on that date
  private estimateIntensityFromDate(date: Date): number {
    const key = date.toISOString().slice(0, 10);
    const match = (this.recentWorkouts || []).filter(w => this.normalizeDate(w.date).toISOString().slice(0, 10) === key);
    if (!match.length) return 5;
    return Math.round(match.reduce((s: number, m: any) => s + (m.intensity || 0), 0) / match.length);
  }

  getWeeklyAverage(): number {
    if (!this.dailyProgress?.length) return 0;
    const total = this.dailyProgress.slice(0, this.rangeDays).reduce((sum, p) => sum + (p.caloriesBurned || 0), 0);
    return Math.round(total / Math.min(this.rangeDays, this.dailyProgress.length));
  }

  getWeeklyConsistency(): number {
    return this.weeklyConsistencyPercent;
  }

  formatDate(date: any): string {
    const d = this.normalizeDate(date);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  getIntensityColor(intensity: number): string {
    if (intensity >= 8) return '#dc3545';
    if (intensity >= 6) return '#fd7e14';
    if (intensity >= 4) return '#ffc107';
    if (intensity >= 2) return '#20c997';
    return '#6c757d';
  }

  // simple BMI calculation fallback
  private calcBMI(weightKg: number, heightCm: number): number {
    if (!weightKg || !heightCm) return 0;
    const h = heightCm / 100;
    return Number((weightKg / (h * h)).toFixed(1));
  }
}