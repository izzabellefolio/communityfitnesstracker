import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutIntensityChart } from './workout-intensity-chart';

describe('WorkoutIntensityChart', () => {
  let component: WorkoutIntensityChart;
  let fixture: ComponentFixture<WorkoutIntensityChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutIntensityChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutIntensityChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
