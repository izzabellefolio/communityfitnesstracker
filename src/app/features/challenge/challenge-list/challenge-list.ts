import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ChallengeService, DailyChallenge, ChallengeExercise } from '../challenge';

@Component({
  selector: 'app-challenge-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './challenge-list.html',
  styleUrls: ['./challenge-list.css']
})
export class ChallengeList implements OnInit, OnDestroy {
  // Challenge Data
  todaysChallenge: DailyChallenge | null = null;
  currentDate: Date = new Date();
  dayName: string = '';
  
  // Stats Data
  totalPoints: number = 1250;
  currentStreak: number = 5;
  completedChallenges: number = 15;
  successRate: number = 85;
  longestStreak: number = 12;
  lastActivity: Date | null = new Date();
  pointsToday: number = 30;
  
  // User Level
  userLevel: number = 3;
  pointsToNextLevel: number = 150;
  
  // UI State
  isLoading: boolean = true;
  showDateChangeNotification: boolean = false;
  showInfoPanel: boolean = false;
  allExercisesCompleted: boolean = false;
  
  // Computed Properties
  get completedExercises(): number {
    return this.todaysChallenge?.exercises.filter((ex: ChallengeExercise) => ex.completed).length || 0;
  }

  get totalExercises(): number {
    return this.todaysChallenge?.exercises.length || 0;
  }

  get completionPercentage(): number {
    if (!this.todaysChallenge || this.totalExercises === 0) return 0;
    return Math.round((this.completedExercises / this.totalExercises) * 100);
  }
  
  // Subscriptions
  private subscriptions: Subscription = new Subscription();
  private lastCheckedDate: string = '';

  constructor(
    private challengeService: ChallengeService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadAllData();
    this.initializeDateWatcher();
    this.updateDayName();
    
    // Subscribe to challenge updates
    this.subscriptions.add(
      this.challengeService.todaysChallenge$.subscribe((challenge: DailyChallenge | null) => {
        this.todaysChallenge = challenge;
        this.updateCompletionStatus();
      })
    );
    
    // Load challenge stats
    this.loadChallengeStats();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadAllData() {
    this.isLoading = true;
    
    // Load todays challenge
    this.subscriptions.add(
      this.challengeService.getTodaysChallenge().subscribe({
        next: (challenge: DailyChallenge) => {
          this.todaysChallenge = challenge;
          this.lastCheckedDate = this.formatDate(new Date());
          this.updateCompletionStatus();
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('Error loading challenge:', error);
          this.isLoading = false;
        }
      })
    );
  }

  loadChallengeStats() {
    this.subscriptions.add(
      this.challengeService.getChallengeStats().subscribe({
        next: (stats: any) => {
          this.completedChallenges = stats.totalCompleted;
          this.longestStreak = stats.longestStreak;
          this.calculateSuccessRate();
        },
        error: (error: any) => {
          console.error('Error loading challenge stats:', error);
        }
      })
    );
  }

  calculateSuccessRate() {
    // Calculate success rate based on completed challenges vs total days
    const daysSinceStart = 30; // This should come from user registration date
    if (daysSinceStart > 0) {
      this.successRate = Math.round((this.completedChallenges / daysSinceStart) * 100);
    }
  }

  initializeDateWatcher() {
    // Check every 30 seconds if date has changed
    this.subscriptions.add(
      interval(30000).subscribe(() => {
        this.checkDateChange();
      })
    );
  }

  checkDateChange() {
    const currentDateStr = this.formatDate(new Date());
    
    if (currentDateStr !== this.lastCheckedDate) {
      this.showDateChangeNotification = true;
      this.lastCheckedDate = currentDateStr;
      this.updateDayName();
      
      // Auto-refresh after 5 seconds if notification not dismissed
      setTimeout(() => {
        if (this.showDateChangeNotification) {
          this.refreshChallenge();
          this.showDateChangeNotification = false;
        }
      }, 5000);
    }
  }

  checkDateManually() {
    this.checkDateChange();
  }

  updateDayName() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.dayName = days[this.currentDate.getDay()];
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  updateCompletionStatus() {
    if (!this.todaysChallenge) return;
    
    this.allExercisesCompleted = this.todaysChallenge.exercises.every((ex: ChallengeExercise) => ex.completed);
  }

  // Points & Streak Methods
  getPointsProgress(): number {
    const pointsInCurrentLevel = this.totalPoints % 500; // Assuming 500 points per level
    return Math.min(100, (pointsInCurrentLevel / 500) * 100);
  }

  getRankTitle(): string {
    if (this.userLevel >= 10) return 'Elite';
    if (this.userLevel >= 7) return 'Advanced';
    if (this.userLevel >= 4) return 'Intermediate';
    return 'Beginner';
  }

  getExercisePoints(): number {
    return 10; // Base points per exercise
  }

  getChallengePoints(): number {
    if (!this.todaysChallenge) return 0;
    
    const basePoints = this.totalExercises * this.getExercisePoints();
    const bonusPoints = this.getChallengeBonus();
    return basePoints + bonusPoints;
  }

  getChallengeBonus(): number {
    // Bonus points for completing the entire challenge
    return 50;
  }

  getEarnedPoints(): number {
    if (!this.todaysChallenge) return 0;
    
    const completedExercises = this.todaysChallenge.exercises.filter((ex: ChallengeExercise) => ex.completed).length;
    return completedExercises * this.getExercisePoints();
  }

  getTotalPoints(): number {
    if (!this.todaysChallenge) return 0;
    return this.totalExercises * this.getExercisePoints() + this.getChallengeBonus();
  }

  getPointsPercentage(): number {
    if (this.getTotalPoints() === 0) return 0;
    return Math.round((this.getEarnedPoints() / this.getTotalPoints()) * 100);
  }

  getCompletedReps(exercise: ChallengeExercise): number {
    return exercise.completedReps || 0;
  }

  // Exercise Actions
  toggleExercise(exerciseId: string) {
    if (!this.todaysChallenge) return;
    
    const exercise = this.todaysChallenge.exercises.find((ex: ChallengeExercise) => ex.id === exerciseId);
    if (exercise) {
      exercise.completed = !exercise.completed;
      this.markExerciseComplete(exerciseId);
    }
  }

  markExerciseComplete(exerciseId: string) {
    if (!this.todaysChallenge?.id) return;
    
    const exercise = this.todaysChallenge.exercises.find((ex: ChallengeExercise) => ex.id === exerciseId);
    if (!exercise) return;
    
    this.subscriptions.add(
      this.challengeService.markExerciseComplete(
        this.todaysChallenge.id, 
        exerciseId,
        exercise.completedReps || exercise.reps
      ).subscribe({
        next: (success: boolean) => {
          if (success) {
            // Update points
            this.totalPoints += this.getExercisePoints();
            this.pointsToday += this.getExercisePoints();
            
            // Check if challenge is now completed
            this.updateCompletionStatus();
          }
        },
        error: (error: any) => {
          console.error('Error marking exercise complete:', error);
        }
      })
    );
  }

  updateExerciseReps(exerciseId: string, change: number) {
    if (!this.todaysChallenge) return;
    
    const exercise = this.todaysChallenge.exercises.find((ex: ChallengeExercise) => ex.id === exerciseId);
    if (!exercise || exercise.completed) return;
    
    let newReps = (exercise.completedReps || 0) + change;
    newReps = Math.max(0, Math.min(newReps, exercise.reps));
    
    exercise.completedReps = newReps;
    
    // Auto-mark as completed if reps reach target
    if (newReps >= exercise.reps && !exercise.completed) {
      exercise.completed = true;
      this.markExerciseComplete(exerciseId);
    }
  }

  completeAllExercises() {
    if (!this.todaysChallenge) return;
    
    this.todaysChallenge.exercises.forEach((exercise: ChallengeExercise) => {
      if (!exercise.completed) {
        exercise.completed = true;
        exercise.completedReps = exercise.reps;
        this.markExerciseComplete(exercise.id);
      }
    });
  }

  completeChallenge() {
    if (!this.todaysChallenge?.id || !this.allExercisesCompleted) return;
    
    // Calculate completion time (estimate based on exercises)
    const completionTime = this.estimateTime();
    
    this.subscriptions.add(
      this.challengeService.completeChallenge(this.todaysChallenge.id, completionTime).subscribe({
        next: (success: boolean) => {
          if (success) {
            // Add bonus points
            this.totalPoints += this.getChallengeBonus();
            this.pointsToday += this.getChallengeBonus();
            
            // Update streak
            this.currentStreak++;
            
            // Show success message
            alert(`Challenge completed! You earned ${this.getChallengeBonus()} bonus points!`);
          }
        },
        error: (error: any) => {
          console.error('Error completing challenge:', error);
        }
      })
    );
  }

  estimateTime(): number {
    if (!this.todaysChallenge) return 30;
    
    // Simple estimation: 2 minutes per set + rest time
    let totalTime = 0;
    this.todaysChallenge.exercises.forEach((exercise: ChallengeExercise) => {
      const exerciseTime = (exercise.sets * 2) + (exercise.restTime || 60) / 60;
      totalTime += exerciseTime;
    });
    
    return Math.ceil(totalTime);
  }

  // Navigation Actions
  viewChallengeHistory() {
    this.router.navigate(['/challenges/history']);
  }

  refreshChallenge() {
    this.isLoading = true;
    
    this.subscriptions.add(
      this.challengeService.refreshTodaysChallenge().subscribe({
        next: (challenge: DailyChallenge) => {
          this.todaysChallenge = challenge;
          this.isLoading = false;
          this.showDateChangeNotification = false;
        },
        error: (error: any) => {
          console.error('Error refreshing challenge:', error);
          this.isLoading = false;
        }
      })
    );
  }

  // Info Panel Methods
  showPointsInfo() {
    this.showInfoPanel = true;
  }

  showStreakInfo() {
    this.showInfoPanel = true;
  }

  closeInfoPanel() {
    this.showInfoPanel = false;
  }

  dismissNotification() {
    this.showDateChangeNotification = false;
    this.refreshChallenge();
  }

  shareProgress() {
    const shareText = `🔥 I'm on a ${this.currentStreak}-day challenge streak! ` +
                     `Completed ${this.completedChallenges} challenges with ` +
                     `${this.totalPoints} total points. #FitnessChallenge`;
    
    if (navigator.share) {
      navigator.share({
        title: 'My Fitness Challenge Progress',
        text: shareText,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Progress copied to clipboard! Share it with your friends.');
    }
  }
}