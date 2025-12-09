import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, doc, updateDoc, arrayUnion } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

import { RoutineService } from '../../../core/services/routine.service';
import { ProgressService } from '../../../core/services/progress.service';
import { Routine } from '../../../shared/models/routine.model';

@Component({
  selector: 'app-routine-detail',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './routine-detail.html',
  styleUrls: ['./routine-detail.css'],
})
export class RoutineDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private routineService = inject(RoutineService);
  private progressService = inject(ProgressService);
  private firestore = inject(Firestore);

  routine: Routine | null = null;
  loading = true;
  workoutStarted = false;
  currentExerciseIndex = 0;
  workoutNotes = '';
  showDeleteConfirm = false;
  editingExerciseIndex: number | null = null;
  exerciseToAdd: any = null;

  // Timer
  // total elapsed seconds for the whole workout (kept for analytics if needed)
  totalElapsedSeconds = 0;

  // Interval + running flag
  timerInterval: any = null;
  isTimerRunning = false;

  // Per-exercise timing
  exerciseTimeRequiredSeconds = 0; // static required seconds for current exercise (duration * 60)
  exerciseRemainingSeconds = 0;    // countdown seconds for the current exercise

  // indices of exercises that have been completed (by duration)
  completedExerciseIndices = new Set<number>();

  // optional routine-level total required seconds (if a routine-level duration is provided)
  routineTotalRequiredSeconds = 0;

  isPremade = false;

  ngOnInit() {
    const routineId = this.route.snapshot.paramMap.get('id');
    if (routineId) {
      this.loadRoutine(routineId);
    } else {
      this.router.navigate(['/routines']);
    }
  }

  ngOnDestroy() {
    this.stopExerciseTimer();
  }

  loadRoutine(id: string) {
    this.routineService.getRoutineById(id).subscribe({
      next: (routine) => {
        if (!routine) {
          this.router.navigate(['/routines']);
          return;
        }
        routine.exercises = (routine.exercises || []).map(e => ({ ...e, isCustom: e.isCustom || false }));
        this.routine = routine;
        this.loading = false;
        this.isPremade = !!routine.isTemplate || !routine.userId;
      },
      error: (error) => {
        console.error('Error loading routine:', error);
        this.loading = false;
        alert('Failed to load routine');
        this.router.navigate(['/routines']);
      },
    });
  }

  // Workout Mode
  startWorkout() {
    if (!this.routine) return;
    this.workoutStarted = true;
    this.currentExerciseIndex = 0;
    this.totalElapsedSeconds = 0; // reset only when starting a workout
    this.completedExerciseIndices.clear();
    this.computeRoutineTotalRequiredSeconds();
    this.updateExerciseDuration(); // set required duration and remaining for first exercise
    if (this.exerciseTimeRequiredSeconds > 0) {
      this.startExerciseTimer();
    }
  }

  nextExercise() {
    if (!this.routine) return;
    if (this.currentExerciseIndex < this.routine.exercises.length - 1) {
      // stop current countdown
      this.stopExerciseTimer();

      // optionally mark as completed if user moves on before timer hits zero
      // uncomment if you want skipping to count as completion:
      // if (this.exerciseTimeRequiredSeconds > 0 && this.exerciseRemainingSeconds > 0) {
      //   this.completedExerciseIndices.add(this.currentExerciseIndex);
      // }

      this.currentExerciseIndex++;

      // prepare the next exercise countdown and start if it has duration
      this.updateExerciseDuration();
      if (this.exerciseTimeRequiredSeconds > 0) {
        this.startExerciseTimer();
      }
    }
  }

  previousExercise() {
    if (this.currentExerciseIndex > 0) {
      this.stopExerciseTimer();
      this.currentExerciseIndex--;
      this.updateExerciseDuration();
      if (this.exerciseTimeRequiredSeconds > 0) {
        this.startExerciseTimer();
      }
    }
  }

  goToExercise(index: number) {
    if (!this.routine) return;
    if (index < 0 || index >= this.routine.exercises.length) return;
    this.stopExerciseTimer();
    this.currentExerciseIndex = index;
    this.updateExerciseDuration();
    if (this.exerciseTimeRequiredSeconds > 0) {
      this.startExerciseTimer();
    }
  }

  private updateExerciseDuration() {
    const currentExercise = this.getCurrentExercise();
    const durationSec = currentExercise?.duration ? currentExercise.duration * 60 : 0;
    this.exerciseTimeRequiredSeconds = durationSec;
    // Reset the remaining seconds when switching to an exercise
    this.exerciseRemainingSeconds = durationSec;

    // Immediately mark exercises with no duration as completed
    if (durationSec === 0) {
      this.completedExerciseIndices.add(this.currentExerciseIndex);
      // ensure timer is stopped
      this.stopExerciseTimer();
    }
  }

  startExerciseTimer() {
    // don't start if already running
    if (this.timerInterval) return;

    // if exercise has no duration, do nothing
    if (this.exerciseTimeRequiredSeconds === 0 || this.exerciseRemainingSeconds === 0) {
      this.isTimerRunning = false;
      return;
    }

    this.isTimerRunning = true;
    this.timerInterval = setInterval(() => {
      // track total time optionally
      this.totalElapsedSeconds++;

      if (this.exerciseRemainingSeconds > 0) {
        this.exerciseRemainingSeconds--;
      }

      // When it reaches zero, mark completed and stop the timer.
      if (this.exerciseRemainingSeconds <= 0) {
        this.completedExerciseIndices.add(this.currentExerciseIndex);
        this.stopExerciseTimer();
        // Wait for user to press Next (do not auto-advance)
      }
    }, 1000);
  }

  stopExerciseTimer() {
    this.isTimerRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  pauseTimer() {
    this.stopExerciseTimer();
  }

  resumeTimer() {
    // Only resume if there is remaining time
    if (this.exerciseTimeRequiredSeconds > 0 && this.exerciseRemainingSeconds > 0) {
      this.startExerciseTimer();
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Complete / quick complete — ensure completed date is written before logging
  async completeWorkout() {
    if (!this.routine) return;
    if (!confirm('Mark this workout as complete?')) return;

    this.stopExerciseTimer();
    if (!this.routine.id) return;

    try {
      await this.markRoutineCompleted(this.routine.id);
      console.log('[RoutineDetail] Routine marked completed');
    } catch (err) {
      console.error('Error marking routine completed:', err);
      alert('Failed to mark routine complete');
      return;
    }

    try {
      await firstValueFrom(this.progressService.logWorkout(this.routine, this.workoutNotes));
      console.log('[RoutineDetail] Workout logged successfully');
      alert('🎉 Workout completed successfully!');
      this.router.navigate(['/progress']);
    } catch (err) {
      console.error('Error logging workout:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert('Failed to log workout: ' + errorMessage);
    }
  }

  async quickComplete() {
    if (!this.routine) return;
    if (!confirm('Mark this routine as completed?')) return;
    if (!this.routine.id) return;

    try {
      await this.markRoutineCompleted(this.routine.id);
      console.log('[RoutineDetail] Routine marked completed');
    } catch (err) {
      console.error('Error marking routine completed:', err);
      alert('Failed to mark routine complete');
      return;
    }

    try {
      await firstValueFrom(this.progressService.logWorkout(this.routine));
      console.log('[RoutineDetail] Workout logged successfully');
      alert('Workout logged successfully! 🎉');
      this.router.navigate(['/progress']);
    } catch (err) {
      console.error('Error logging workout:', err);
      alert('Failed to log workout');
    }
  }

  async markRoutineCompleted(routineId: string) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const ref = doc(this.firestore, `routines/${routineId}`);
    await updateDoc(ref, { completedDates: arrayUnion(today) });
  }

  // DELETE Routine (user copy only)
  deleteRoutine() {
    if (!this.routine?.id) return;

    this.routineService.deleteUserRoutine(this.routine.id).subscribe({
      next: () => {
        alert('Routine deleted successfully!');
        this.router.navigate(['/routines']);
      },
      error: (error) => {
        console.error('Error deleting routine:', error);
        alert('Failed to delete routine');
      },
    });
  }

  // Add Exercise
  addExercise(exercise: any) {
    if (!this.routine) return;

    const newExercise = { ...exercise, isCustom: true };

    // If routine is premade, clone to create user-owned editable copy, then add exercise
    if (this.isPremade) {
      this.routineService.clonePremadeRoutine(this.routine).subscribe({
        next: (newId) => {
          const updatedRoutine: Routine = {
            ...this.routine!,
            id: newId,
            isPremade: false,
            exercises: [...(this.routine!.exercises || []), newExercise]
          };
          this.routineService.updateRoutine(updatedRoutine).subscribe({
            next: () => {
              this.routine = updatedRoutine;
              this.isPremade = false;
              alert('Exercise added to your copy of the routine!');
              this.editExercise(this.routine.exercises.length - 1);
            },
            error: (err) => {
              console.error('[RoutineDetail] addExercise -> update cloned routine error:', err);
              alert(err?.message || 'Failed to add exercise to cloned routine');
            }
          });
        },
        error: (err) => {
          console.error('[RoutineDetail] addExercise -> clone error:', err);
          alert(err?.message || 'Failed to create a personal copy of this routine');
        }
      });
      return;
    }

    // Non-premade: do not mutate local state until backend confirms
    const updatedRoutine: Routine = {
      ...this.routine,
      exercises: [...(this.routine.exercises || []), newExercise]
    };

    this.routineService.updateRoutine(updatedRoutine).subscribe({
      next: () => {
        if (this.routine) this.routine.exercises = updatedRoutine.exercises;
        alert('Exercise added successfully!');
        this.editExercise((this.routine?.exercises.length || 1) - 1);
      },
      error: (error) => {
        console.error('Error adding exercise:', error);
        alert(error?.message || 'Failed to add exercise');
      },
    });
  }

  // Edit / Save / Delete exercise
  editExercise(index: number) {
    if (!this.routine) return;
    this.editingExerciseIndex = index;
    this.exerciseToAdd = { ...this.routine.exercises[index] };
  }

  saveExercise() {
    if (this.editingExerciseIndex === null || !this.routine) return;

    const idx = this.editingExerciseIndex;
    const updatedExercises = [...this.routine.exercises];
    updatedExercises[idx] = { ...this.exerciseToAdd };

    const updatedRoutine: Routine = {
      ...this.routine,
      exercises: updatedExercises
    };

    this.routineService.updateRoutine(updatedRoutine).subscribe({
      next: () => {
        if (this.routine) this.routine.exercises = updatedExercises;
        alert('Exercise updated!');
        this.editingExerciseIndex = null;
        this.exerciseToAdd = null;
      },
      error: (err) => {
        console.error('[RoutineDetail] saveExercise error:', err);
        alert(err?.message || 'Failed to update exercise.');
      }
    });
  }

  deleteExercise(index: number) {
    if (!this.routine) return;
    if (!confirm('Are you sure you want to delete this exercise?')) return;

    const updatedExercises = this.routine.exercises.filter((_, i) => i !== index);
    const updatedRoutine: Routine = {
      ...this.routine,
      exercises: updatedExercises
    };

    this.routineService.updateRoutine(updatedRoutine).subscribe({
      next: () => {
        if (this.routine) this.routine.exercises = updatedExercises;
        alert('Exercise deleted!');
      },
      error: (err) => {
        console.error('[RoutineDetail] deleteExercise error:', err);
        alert(err?.message || 'Failed to delete exercise.');
      }
    });
  }

  // Cancel editing
  cancelEdit() {
    this.editingExerciseIndex = null;
    this.exerciseToAdd = null;
  }

  cancelWorkout() {
    if (confirm('Are you sure you want to cancel this workout?')) {
      this.stopExerciseTimer();
      this.workoutStarted = false;
      this.currentExerciseIndex = 0;
      this.workoutNotes = '';
    }
  }

  getCurrentExercise() {
    return this.routine?.exercises[this.currentExerciseIndex];
  }

  // remaining seconds for the current exercise (derived)
  getRemainingTime(): number {
    return this.exerciseRemainingSeconds ?? 0;
  }

  isCurrentExerciseComplete(): boolean {
    // If exercise has no duration, it's considered complete.
    if (this.exerciseTimeRequiredSeconds === 0) return true;
    // Otherwise check if we've hit zero or it's in the completed set
    return this.exerciseRemainingSeconds === 0 || this.completedExerciseIndices.has(this.currentExerciseIndex);
  }

  // If routine has an explicit total duration field (minutes) we honor it; otherwise we sum exercise durations
  computeRoutineTotalRequiredSeconds() {
    if (!this.routine) {
      this.routineTotalRequiredSeconds = 0;
      return;
    }
    // Support optional routine-level duration (minutes)
    // @ts-ignore - some routines may include a `duration` property
    const declared = (this.routine as any).duration;
    if (declared && typeof declared === 'number' && declared > 0) {
      this.routineTotalRequiredSeconds = declared * 60;
      return;
    }

    // otherwise sum the exercise durations (in minutes -> seconds)
    const totalMinutes = (this.routine.exercises || []).reduce((s, ex: any) => s + (ex.duration || 0), 0);
    this.routineTotalRequiredSeconds = totalMinutes * 60;
  }

  getProgressPercentage(): number {
    if (!this.routine || !this.routine.exercises || this.routine.exercises.length === 0) return 0;
    return ((this.currentExerciseIndex + 1) / this.routine.exercises.length) * 100;
  }

  confirmDeleteRoutine() {
    const message = "Are you sure you want to delete this routine?";

    if (confirm(message)) {
      this.deleteRoutine();
    }
  }
}