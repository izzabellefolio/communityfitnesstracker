import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { ProgressService } from '../progress';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// When using 'chart.js/auto', all components are auto-registered
import 'chart.js/auto';

@Component({
  selector: 'app-progress-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, RouterModule, FormsModule],
  templateUrl: './progress-chart.html',
  styleUrls: ['./progress-chart.css']
})
export class ProgressChart implements OnInit {
  private progressService = inject(ProgressService);

  loading = true;
  selectedPeriod: 'week' | 'month' | 'year' = 'week';

  // Line Chart Configuration
  public lineChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Calories Burned',
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: {
        display: true,
        text: 'Calories Burned Over Time'
      }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  public lineChartType: ChartType = 'line';

  // Bar Chart - Workouts
  public barChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Workouts Completed',
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 2
      }
    ]
  };

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: {
        display: true,
        text: 'Workout Frequency'
      }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  public barChartType: ChartType = 'bar';

  // Bar Chart - Reps
  public repsChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Total Reps',
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 2
      }
    ]
  };

  public repsChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: {
        display: true,
        text: 'Total Reps Completed'
      }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  public repsChartType: ChartType = 'bar';

  ngOnInit() {
    console.log('[ProgressChart] Component initialized');
    this.loadChartData();
  }

  loadChartData() {
    console.log('[ProgressChart] loadChartData called, period:', this.selectedPeriod);
    this.loading = true;
    
    this.progressService.getUserWorkoutLogs().subscribe({
      next: (logs) => {
        console.log('[ProgressChart] received logs:', logs.length, 'logs');
        console.log('[ProgressChart] sample log:', logs[0]);
        
        if (!logs || logs.length === 0) {
          console.warn('[ProgressChart] No logs found - showing empty charts');
          this.setEmptyChartData();
          this.loading = false;
          return;
        }

        const chartData = this.processChartData(logs);
        console.log('[ProgressChart] processed chart data:', chartData);
        
        // Update line chart (calories) - create new object for change detection
        this.lineChartData = {
          labels: [...chartData.labels],
          datasets: [{
            ...this.lineChartData.datasets[0],
            data: [...chartData.calories]
          }]
        };

        // Update bar chart (workouts count)
        this.barChartData = {
          labels: [...chartData.labels],
          datasets: [{
            ...this.barChartData.datasets[0],
            data: [...chartData.workouts]
          }]
        };

        // Update reps chart
        this.repsChartData = {
          labels: [...chartData.labels],
          datasets: [{
            ...this.repsChartData.datasets[0],
            data: [...chartData.reps]
          }]
        };

        console.log('[ProgressChart] charts updated successfully');
        console.log('Line chart data:', this.lineChartData);
        console.log('Bar chart data:', this.barChartData);
        console.log('Reps chart data:', this.repsChartData);
        
        this.loading = false;
      },
      error: (error) => {
        console.error('[ProgressChart] Error loading chart data:', error);
        this.setEmptyChartData();
        this.loading = false;
        alert('Failed to load progress data: ' + (error?.message || String(error)));
      }
    });
  }

  private setEmptyChartData() {
    const emptyLabels = this.getEmptyLabels();
    const emptyData = new Array(emptyLabels.length).fill(0);

    console.log('[ProgressChart] Setting empty chart data with labels:', emptyLabels);

    this.lineChartData = {
      labels: [...emptyLabels],
      datasets: [{ ...this.lineChartData.datasets[0], data: [...emptyData] }]
    };

    this.barChartData = {
      labels: [...emptyLabels],
      datasets: [{ ...this.barChartData.datasets[0], data: [...emptyData] }]
    };

    this.repsChartData = {
      labels: [...emptyLabels],
      datasets: [{ ...this.repsChartData.datasets[0], data: [...emptyData] }]
    };
  }

  private getEmptyLabels(): string[] {
    if (this.selectedPeriod === 'week') {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    } else if (this.selectedPeriod === 'month') {
      return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    } else {
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }
  }

  processChartData(logs: any[]) {
    const now = new Date();
    const data: {
      labels: string[],
      calories: number[],
      workouts: number[],
      reps: number[]
    } = {
      labels: [],
      calories: [],
      workouts: [],
      reps: []
    };

    if (this.selectedPeriod === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        data.labels.push(dateStr);

        const dayLogs = logs.filter(log => {
          if (!log.date) return false;
          const logDate = new Date(log.date);
          logDate.setHours(0, 0, 0, 0);
          return logDate.getTime() === date.getTime();
        });

        data.calories.push(
          dayLogs.reduce((sum, log) => sum + (log.caloriesBurned || 0), 0)
        );
        data.workouts.push(dayLogs.length);
        data.reps.push(
          dayLogs.reduce((sum, log) => sum + (log.totalReps || 0), 0)
        );
      }
    } else if (this.selectedPeriod === 'month') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7) - 6);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        weekEnd.setHours(23, 59, 59, 999);

        data.labels.push(`Week ${4 - i}`);

        const weekLogs = logs.filter(log => {
          if (!log.date) return false;
          const logDate = new Date(log.date);
          return logDate >= weekStart && logDate <= weekEnd;
        });

        data.calories.push(
          weekLogs.reduce((sum, log) => sum + (log.caloriesBurned || 0), 0)
        );
        data.workouts.push(weekLogs.length);
        data.reps.push(
          weekLogs.reduce((sum, log) => sum + (log.totalReps || 0), 0)
        );
      }
    } else {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now);
        monthDate.setMonth(monthDate.getMonth() - i);

        const monthStr = monthDate.toLocaleDateString('en-US', { month: 'short' });
        data.labels.push(monthStr);

        const monthLogs = logs.filter(log => {
          if (!log.date) return false;
          const logDate = new Date(log.date);
          return logDate.getMonth() === monthDate.getMonth() &&
                 logDate.getFullYear() === monthDate.getFullYear();
        });

        data.calories.push(
          monthLogs.reduce((sum, log) => sum + (log.caloriesBurned || 0), 0)
        );
        data.workouts.push(monthLogs.length);
        data.reps.push(
          monthLogs.reduce((sum, log) => sum + (log.totalReps || 0), 0)
        );
      }
    }

    console.log('[ProgressChart] Processed data:', data);
    return data;
  }

  changePeriod(period: 'week' | 'month' | 'year') {
    console.log('[ProgressChart] Changing period to:', period);
    this.selectedPeriod = period;
    this.loadChartData();
  }
}