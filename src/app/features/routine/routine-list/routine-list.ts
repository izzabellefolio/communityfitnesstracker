import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { RoutineService } from '../routine';
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

    this.routineService.deleteUserRoutine(id).subscribe({
      next: () => {
        this.routines = this.routines.filter(r => r.id !== id);
        alert('Routine deleted successfully!');
      },
      error: (error) => {
        console.error('Error deleting routine:', error);
        alert('Failed to delete routine');
      }
    });
  }
}
