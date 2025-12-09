import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { LeaderboardEntry } from '../../../shared/models/leaderboard-entry.model';
import { RoutineService } from '../../../core/services/routine.service';
import { Routine } from '../../../shared/models';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './leaderboard.html',
  styleUrls: ['./leaderboard.css'],
})
export class LeaderboardComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);
  private auth = inject(Auth);
  private routineService = inject(RoutineService);

  leaderboardEntries: LeaderboardEntry[] = [];
  topUsers: LeaderboardEntry[] = [];
  currentUserRank: number | null = null;
  currentUserId: string | null = null;
  currentUserEntry: LeaderboardEntry | null = null;
  loading = true;

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  ngOnInit() {
    this.currentUserId = this.auth.currentUser?.uid || null;
    this.loadLeaderboard();
  }

  loadLeaderboard() {
    this.leaderboardService.getLeaderboard().subscribe({
      next: (entries) => {
        this.leaderboardEntries = entries;
        this.topUsers = entries.slice(0, 10);
        this.totalPages = Math.ceil(entries.length / this.itemsPerPage);
        
        // Find current user's entry and rank
        const currentUser = entries.find(e => e.userId === this.currentUserId);
        if (currentUser) {
          this.currentUserRank = currentUser.rank || null;
          this.currentUserEntry = currentUser;
        }
        
        this.loading = false;
        console.log('Leaderboard loaded:', entries);
      },
      error: (error) => {
        console.error('Error loading leaderboard:', error);
        this.loading = false;
      }
    });
  }

  getPaginatedEntries(): LeaderboardEntry[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.leaderboardEntries.slice(startIndex, endIndex);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number) {
    this.currentPage = page;
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  getRankBadgeClass(rank: number | undefined): string {
    if (!rank) return 'bg-secondary';
    if (rank === 1) return 'bg-warning text-dark';
    if (rank === 2) return 'bg-secondary text-white';
    if (rank === 3) return 'bg-danger';
    return 'bg-primary';
  }

  getRankIcon(rank: number | undefined): string {
    if (!rank) return '';
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏅';
  }

  isCurrentUser(userId: string): boolean {
    return userId === this.currentUserId;
  }
}