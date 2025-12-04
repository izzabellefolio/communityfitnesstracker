import { TestBed } from '@angular/core/testing';

import { Routine } from './routine';

describe('Routine', () => {
  let service: Routine;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Routine);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
