import { TestBed } from '@angular/core/testing';

import { CaloriesService } from './calories.service';

describe('CaloriesService', () => {
  let service: CaloriesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CaloriesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
