import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChallengeCard } from './challenge-card';

describe('ChallengeCard', () => {
  let component: ChallengeCard;
  let fixture: ComponentFixture<ChallengeCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChallengeCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChallengeCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
