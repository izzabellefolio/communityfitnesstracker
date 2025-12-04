import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PremadeRoutines } from './premade-routines';

describe('PremadeRoutines', () => {
  let component: PremadeRoutines;
  let fixture: ComponentFixture<PremadeRoutines>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PremadeRoutines]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PremadeRoutines);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
