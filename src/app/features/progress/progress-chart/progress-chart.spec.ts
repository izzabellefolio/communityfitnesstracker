import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressChart } from './progress-chart';

describe('ProgressChart', () => {
  let component: ProgressChart;
  let fixture: ComponentFixture<ProgressChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProgressChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
