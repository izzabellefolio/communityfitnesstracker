import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UserMetrics as AppMetrics } from '../../shared/models';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  // Default metrics so legacy callers can read properties synchronously
  private _metrics = new BehaviorSubject<AppMetrics>({
    userId: '',
    weight: 75,
    height: 170,
    metabolism: 'medium',
    gender: 'male',
    bmi: 24.1,
    lastUpdated: new Date()
  });
  userMetrics$ = this._metrics.asObservable();

  // Flag to indicate metrics are loaded
  private _loaded = new BehaviorSubject<boolean>(false);
  metricsLoaded$ = this._loaded.asObservable();

  // Synchronous getter for legacy code
  get userMetrics(): AppMetrics {
    return this._metrics.getValue();
  }

  // Update metrics and mark loaded
  setMetrics(metrics: AppMetrics) {
    this._metrics.next(metrics);
    this._loaded.next(true);
  }

  // Snapshot getter
  getMetricsSnapshot(): AppMetrics {
    return this._metrics.getValue();
  }

  // Mark loaded without changing metrics
  markLoaded() {
    this._loaded.next(true);
  }
}
