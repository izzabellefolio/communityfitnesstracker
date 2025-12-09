import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RoutineService } from '../../../core/services/routine.service';
import { Routine, Exercise } from '../../../shared/models'; // Import from models

@Component({
  selector: 'app-routine-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './routine-create.html',
  styleUrls: ['./routine-create.css']
})
export class RoutineCreate {
  private routineService = inject(RoutineService);
  private router = inject(Router);

  // Form data
  routineName = '';
  routineDescription = '';
  selectedDays: string[] = [];
  selectedTime = '09:00';

  // Exercise form
  exercises: Exercise[] = [];
  currentExercise: Exercise = this.getEmptyExercise();

  // Options
  daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  exerciseTypes = ['Strength', 'Cardio', 'Flexibility', 'Balance'];
  intensityLevels: ('Low' | 'Medium' | 'High')[] = ['Low', 'Medium', 'High'];

  getEmptyExercise(): Exercise {
    return {
      name: '',
      type: 'strength',
      sets: 3,
      reps: 10,
      duration: 0,
      intensity: 0,
      caloriesPerMinute: 0
    };
  }

  toggleDay(day: string) {
    const index = this.selectedDays.indexOf(day);
    if (index > -1) {
      this.selectedDays.splice(index, 1);
    } else {
      this.selectedDays.push(day);
    }
  }

  addExercise() {
    if (!this.currentExercise.name.trim()) {
      alert('Please enter exercise name');
      return;
    }

    this.exercises.push({ ...this.currentExercise });
    this.currentExercise = this.getEmptyExercise();
  }

  removeExercise(index: number) {
    this.exercises.splice(index, 1);
  }

  saveRoutine() {
    // Validation
    if (!this.routineName.trim()) {
      alert('Please enter a routine name');
      return;
    }

    if (this.selectedDays.length === 0) {
      alert('Please select at least one day');
      return;
    }

    if (this.exercises.length === 0) {
      alert('Please add at least one exercise');
      return;
    }

    const routine: Routine = {
      userId: '', // Will be set by service
      name: this.routineName,
      description: this.routineDescription,
      schedule: this.selectedDays,
      time: this.selectedTime,
      exercises: this.exercises
    };

    this.routineService.createRoutine(routine).subscribe({
      next: (id) => {
        console.debug('[RoutineCreate] routine created with id:', id);
        alert('Routine created successfully!');
        this.router.navigate(['/routines']);
      },
      error: (error) => {
        console.error('[RoutineCreate] Error creating routine:', error);
        alert('Failed to create routine');
      }
    });
  }
}