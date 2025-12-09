import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressService } from '../../../core/services/progress.service';
import { WorkoutLogModel } from '../../../shared/models/workout-log.model';
import { RouterModule, RouterLink } from '@angular/router';

@Component({
  selector: 'app-workout-log',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink],
  templateUrl: './workout-log.html',
  styleUrls: ['./workout-log.css'],
})
export class WorkoutLog implements OnInit {
  Math = Math;

  private progressService = inject(ProgressService);

  workoutLogs: WorkoutLogModel[] = [];
  loading = true;
  selectedLog: WorkoutLogModel | null = null;

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  ngOnInit() {
    this.loadWorkoutLogs();
  }

  loadWorkoutLogs() {
    this.loading = true;
    this.progressService.getUserWorkoutLogs().subscribe({
      next: (logs) => {
        this.workoutLogs = logs || [];
        this.totalItems = this.workoutLogs.length;
        this.loading = false;
        console.log('Workout logs loaded:', logs);
      },
      error: (error) => {
        console.error('Error loading workout logs:', error);
        this.loading = false;
      }
    });
  }

  // Pagination helpers
  getPaginatedLogs(): WorkoutLogModel[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.workoutLogs.slice(start, end);
  }

  getTotalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage) || 1;
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
    }
  }

  // Existing detail handlers
  viewDetails(log: WorkoutLogModel) {
    this.selectedLog = log;
  }

  closeDetails() {
    this.selectedLog = null;
  }

  // Display helpers
  formatDate(date: any): string {
    if (!date) return 'N/A';
    const d = (date.toDate && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  getIntensityColor(score: number): string {
    if (score >= 8) return '#dc3545';
    if (score >= 6) return '#fd7e14';
    if (score >= 4) return '#ffc107';
    if (score >= 2) return '#20c997';
    return '#6c757d';
  }

  getDurationText(minutes: number): string {
    if (!Number.isFinite(minutes)) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
}