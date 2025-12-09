import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { RoutineService } from '../../../core/services/routine.service';
import { Routine } from '../../../shared/models';

@Component({
  selector: 'app-routine-list',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterModule],
  templateUrl: './routine-list.html',
  styleUrls: ['./routine-list.css']
})
export class RoutineList implements OnInit {
  private routineService = inject(RoutineService);

  routines: Routine[] = [];
  loading = true;
  deletingId: string | null = null;

  ngOnInit() {
    this.loadRoutines();
  }

  loadRoutines() {
    console.debug('[RoutineList] loadRoutines called');
    this.routineService.getUserRoutines().subscribe({
      next: (routines) => {
        console.debug('[RoutineList] received routines:', routines);
        this.routines = routines;
        this.loading = false;
      },
      error: (error) => {
        console.error('[RoutineList] Error loading routines:', error);
        this.loading = false;
      }
    });
  }

  deleteRoutine(id: string | undefined) {
    if (!id || !confirm('Are you sure you want to delete this routine?')) return;

    this.deletingId = id;
    this.routineService.deleteUserRoutine(id).subscribe({
      next: () => {
        this.routines = this.routines.filter(r => r.id !== id);
        this.deletingId = null;
        alert('Routine deleted successfully!');
      },
      error: (error) => {
        console.error('Error deleting routine:', error);
        this.deletingId = null;
        alert('Failed to delete routine');
      }
    });
  }
}
