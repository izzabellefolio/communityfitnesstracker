import { TestBed } from '@angular/core/testing';

import { IntensityService } from './intensity.service';

describe('IntensityService', () => {
  let service: IntensityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IntensityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
