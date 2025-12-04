import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressService } from '../progress';
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

  ngOnInit() {
    this.loadWorkoutLogs();
  }

  loadWorkoutLogs() {
    this.progressService.getUserWorkoutLogs().subscribe({
      next: (logs) => {
        this.workoutLogs = logs;
        this.loading = false;
        console.log('Workout logs loaded:', logs);
      },
      error: (error) => {
        console.error('Error loading workout logs:', error);
        this.loading = false;
      }
    });
  }

  viewDetails(log: WorkoutLogModel) {
    this.selectedLog = log;
  }

  closeDetails() {
    this.selectedLog = null;
  }
}