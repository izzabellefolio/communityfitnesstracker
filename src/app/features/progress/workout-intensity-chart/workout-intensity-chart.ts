import { Component, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-workout-intensity-chart',
  templateUrl: './workout-intensity-chart.html',
  styleUrls: ['./workout-intensity-chart.css']
})
export class WorkoutIntensityChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('intensityChart') chartCanvas!: ElementRef;
  private chart!: Chart;

  ngAfterViewInit() {
    this.createChart();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  private createChart() {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    const config: ChartConfiguration = {
      type: 'radar',
      data: {
        labels: ['Strength', 'Cardio', 'Endurance', 'Flexibility', 'Balance'],
        datasets: [{
          label: 'Workout Intensity',
          data: [8, 7, 6, 5, 4],
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 2,
          pointBackgroundColor: 'rgb(99, 102, 241)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(99, 102, 241)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 10,
            ticks: {
              stepSize: 2
            },
            grid: { color: 'rgba(0, 0, 0, 0.1)' },
            angleLines: { color: 'rgba(0, 0, 0, 0.1)' },
            pointLabels: { font: { size: 11, weight: 500 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Intensity: ${context.parsed?.r ?? 0}/10`
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  updateData(newData: number[]) {
    if (this.chart) {
      this.chart.data.datasets[0].data = newData;
      this.chart.update();
    }
  }
}
