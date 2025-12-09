import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Routine } from '../../shared/models/routine.model';
import { Timestamp } from 'firebase/firestore';

// Embedded premade routines data
const PREMADE_ROUTINES: Routine[] = [
  {
    name: "Beginner Full Body Workout",
    description: "Perfect for fitness beginners. Works all major muscle groups.",
    schedule: ["Monday", "Wednesday", "Friday"],
    time: "09:00",
    isPremade: true,
    userId: "system",
    createdAt: new Date("2024-01-01"),
    exercises: [
      { name: "Push-ups", type: "strength", sets: 3, reps: 10, duration: 0, intensity: 5, caloriesPerMinute: 5 },
      { name: "Bodyweight Squats", type: "strength", sets: 3, reps: 15, duration: 0, intensity: 5, caloriesPerMinute: 5 },
      { name: "Plank", type: "strength", sets: 3, reps: 0, duration: 1, intensity: 5, caloriesPerMinute: 4 },
      { name: "Lunges", type: "strength", sets: 3, reps: 10, duration: 0, intensity: 5, caloriesPerMinute: 5 },
      { name: "Mountain Climbers", type: "cardio", sets: 3, reps: 20, duration: 0, intensity: 8, caloriesPerMinute: 10 }
    ]
  },
  {
    name: "Cardio Blast",
    description: "High-intensity cardio to burn calories and boost endurance.",
    schedule: ["Tuesday", "Thursday", "Saturday"],
    time: "07:00",
    isPremade: true,
    userId: "system",
    createdAt: new Date("2024-01-01"),
    exercises: [
      { name: "Jumping Jacks", type: "cardio", sets: 3, reps: 30, duration: 0, intensity: 8, caloriesPerMinute: 10 },
      { name: "Running in Place", type: "cardio", sets: 1, reps: 0, duration: 1, intensity: 9, caloriesPerMinute: 12 },
      { name: "Burpees", type: "cardio", sets: 3, reps: 15, duration: 0, intensity: 9, caloriesPerMinute: 12 },
      { name: "High Knees", type: "cardio", sets: 3, reps: 30, duration: 0, intensity: 8, caloriesPerMinute: 11 },
      { name: "Jump Rope", type: "cardio", sets: 3, reps: 0, duration: 1, intensity: 9, caloriesPerMinute: 13 }
    ]
  },
  {
    name: "Core Strength Builder",
    description: "Focus on building a strong, stable core.",
    schedule: ["Monday", "Wednesday", "Friday"],
    time: "18:00",
    isPremade: true,
    userId: "system",
    createdAt: new Date("2024-01-01"),
    exercises: [
      { name: "Plank", type: "strength", sets: 4, reps: 0, duration: 1, intensity: 6, caloriesPerMinute: 4 },
      { name: "Russian Twists", type: "strength", sets: 3, reps: 20, duration: 0, intensity: 6, caloriesPerMinute: 6 },
      { name: "Bicycle Crunches", type: "strength", sets: 3, reps: 20, duration: 0, intensity: 6, caloriesPerMinute: 5 },
      { name: "Leg Raises", type: "strength", sets: 3, reps: 15, duration: 0, intensity: 7, caloriesPerMinute: 6 },
      { name: "Side Plank", type: "strength", sets: 3, reps: 0, duration: 1, intensity: 6, caloriesPerMinute: 4 }
    ]
  },
  {
    name: "Upper Body Power",
    description: "Build strength in chest, arms, shoulders, and back.",
    schedule: ["Tuesday", "Thursday"],
    time: "17:00",
    isPremade: true,
    userId: "system",
    createdAt: new Date("2024-01-01"),
    exercises: [
      { name: "Push-ups", type: "strength", sets: 4, reps: 15, duration: 0, intensity: 7, caloriesPerMinute: 6 },
      { name: "Diamond Push-ups", type: "strength", sets: 3, reps: 10, duration: 0, intensity: 8, caloriesPerMinute: 7 },
      { name: "Pike Push-ups", type: "strength", sets: 3, reps: 12, duration: 0, intensity: 7, caloriesPerMinute: 6 },
      { name: "Tricep Dips", type: "strength", sets: 3, reps: 15, duration: 0, intensity: 6, caloriesPerMinute: 5 },
      { name: "Arm Circles", type: "strength", sets: 2, reps: 20, duration: 0, intensity: 3, caloriesPerMinute: 2 }
    ]
  },
  {
    name: "Lower Body Blast",
    description: "Strengthen legs, glutes, and improve lower body power.",
    schedule: ["Monday", "Thursday"],
    time: "16:00",
    isPremade: true,
    userId: "system",
    createdAt: new Date("2024-01-01"),
    exercises: [
      { name: "Squats", type: "strength", sets: 4, reps: 20, duration: 0, intensity: 8, caloriesPerMinute: 7 },
      { name: "Jump Squats", type: "strength", sets: 3, reps: 15, duration: 0, intensity: 9, caloriesPerMinute: 10 },
      { name: "Lunges", type: "strength", sets: 3, reps: 15, duration: 0, intensity: 6, caloriesPerMinute: 5 },
      { name: "Wall Sit", type: "strength", sets: 3, reps: 0, duration: 1, intensity: 8, caloriesPerMinute: 6 },
      { name: "Calf Raises", type: "strength", sets: 4, reps: 20, duration: 0, intensity: 4, caloriesPerMinute: 2 }
    ]
  },
  {
    name: "Morning Yoga Flow",
    description: "Gentle yoga routine to start your day with flexibility and mindfulness.",
    schedule: ["Monday", "Wednesday", "Friday", "Sunday"],
    time: "06:00",
    isPremade: true,
    userId: "system",
    createdAt: new Date("2024-01-01"),
    exercises: [
      { name: "Sun Salutation", type: "flexibility", sets: 3, reps: 5, duration: 0, intensity: 3, caloriesPerMinute: 3 },
      { name: "Downward Dog", type: "flexibility", sets: 1, reps: 0, duration: 2, intensity: 2, caloriesPerMinute: 2 },
      { name: "Warrior Pose", type: "flexibility", sets: 2, reps: 0, duration: 1, intensity: 4, caloriesPerMinute: 2 },
      { name: "Child's Pose", type: "flexibility", sets: 1, reps: 0, duration: 3, intensity: 1, caloriesPerMinute: 1 },
      { name: "Cat-Cow Stretch", type: "flexibility", sets: 3, reps: 10, duration: 0, intensity: 2, caloriesPerMinute: 2 }
    ]
  }
];

@Injectable({
  providedIn: 'root'
})
export class PremadeRoutineService {

  constructor(private http: HttpClient) {}

  /**
   * Get premade routines from embedded data
   * Falls back to JSON file if needed
   */
  getPremadeRoutines(): Observable<Routine[]> {
    // Return embedded data as observable
    return of(PREMADE_ROUTINES);
    
    // Fallback to JSON file (commented out, but available if needed):
    // return this.http.get<Routine[]>('/assets/data/premade-routines.json');
  }

  /**
   * Get a single premade routine by name
   */
  getPremadeRoutineByName(name: string): Observable<Routine | undefined> {
    return of(PREMADE_ROUTINES.find(routine => routine.name === name));
  }

  /**
   * Get premade routines filtered by intensity
   */
  getPremadeRoutinesByIntensity(minIntensity: number): Observable<Routine[]> {
    const filtered = PREMADE_ROUTINES.filter(routine =>
      routine.exercises.some(exercise => exercise.intensity >= minIntensity)
    );
    return of(filtered);
  }
}
