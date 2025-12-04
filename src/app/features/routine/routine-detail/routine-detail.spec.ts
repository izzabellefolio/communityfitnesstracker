import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutineDetail } from './routine-detail';

describe('RoutineDetail', () => {
  let component: RoutineDetail;
  let fixture: ComponentFixture<RoutineDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutineDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoutineDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
