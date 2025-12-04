import { TestBed } from '@angular/core/testing';

import { FitnessApi } from './fitness-api';

describe('FitnessApi', () => {
  let service: FitnessApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FitnessApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
