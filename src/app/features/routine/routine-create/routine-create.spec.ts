import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutineCreate } from './routine-create';

describe('RoutineCreate', () => {
  let component: RoutineCreate;
  let fixture: ComponentFixture<RoutineCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutineCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoutineCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
