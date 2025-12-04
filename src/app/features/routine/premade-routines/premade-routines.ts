import { Component, OnInit, inject } from '@angular/core';
import { PremadeRoutineService } from './premade-routine.service';
import { RoutineService } from '../routine';
import { Routine } from '../../../shared/models/routine.model';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';

@Component({
  selector: 'app-premade-routines',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './premade-routines.html',
  styleUrls: ['./premade-routines.css']
})
export class PremadeRoutines implements OnInit {

  premadeRoutines: Routine[] = [];
  loading = true;

  private router = inject(Router);

  constructor(
    private premadeService: PremadeRoutineService,
    private routineService: RoutineService // this handles saving to user
  ) {}

  ngOnInit(): void {
  this.premadeService.getPremadeRoutines().subscribe({
    next: data => {
      this.premadeRoutines = data;
      this.loading = false;
      console.log('Premade routines loaded:', data); // debug
      this.premadeRoutines = data;
      this.loading = false;
    },
    error: err => {
      console.error('Error loading premade routines:', err);
      this.loading = false;
    }
  });
}

  saveToMyRoutines(routine: Routine) {
    console.debug('[PremadeRoutines] Saving routine:', routine.name);
    this.routineService.clonePremadeRoutine(routine).subscribe({
      next: id => {
        console.debug('[PremadeRoutines] Cloned routine ID:', id);
        alert('Routine saved to your routines');
        this.router.navigate(['/routines']);
      },
      error: err => {
        console.error('[PremadeRoutines] Error saving routine:', err);
        alert('Failed to save routine');
      }
    });
  }
}
