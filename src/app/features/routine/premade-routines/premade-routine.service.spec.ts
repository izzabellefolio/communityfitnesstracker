import { TestBed } from '@angular/core/testing';

import { PremadeRoutineService } from './premade-routine.service';

describe('PremadeRoutineService', () => {
  let service: PremadeRoutineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PremadeRoutineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
