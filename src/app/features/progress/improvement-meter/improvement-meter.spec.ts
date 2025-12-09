import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImprovementMeter } from './improvement-meter';

describe('ImprovementMeter', () => {
  let component: ImprovementMeter;
  let fixture: ComponentFixture<ImprovementMeter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImprovementMeter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImprovementMeter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
