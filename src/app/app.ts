import { Component, signal, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterModule, Router, Event, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { NgIf } from '@angular/common';
import { Navbar } from './shared/components/navbar/navbar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, Navbar, NgIf],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('appdev_communityfitness');
  loading = signal(false);
  private routerSub?: Subscription;

  constructor(private router: Router) {
    // show overlay spinner immediately on navigation start
    this.routerSub = this.router.events.subscribe((e: Event) => {
      if (e instanceof NavigationStart) {
        this.loading.set(true);
      }
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
