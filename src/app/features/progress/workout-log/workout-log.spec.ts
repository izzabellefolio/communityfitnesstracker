import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutLog } from './workout-log';

describe('WorkoutLog', () => {
  let component: WorkoutLog;
  let fixture: ComponentFixture<WorkoutLog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutLog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutLog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
