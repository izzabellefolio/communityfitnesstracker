import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Routine } from '../../shared/models/routine.model';

@Injectable({
  providedIn: 'root'
})
export class PremadeRoutineService {

  constructor(private http: HttpClient) {}

  getPremadeRoutines(): Observable<Routine[]> {
    return this.http.get<Routine[]>('/assetss/data/premade-routines.json');
  }
}
