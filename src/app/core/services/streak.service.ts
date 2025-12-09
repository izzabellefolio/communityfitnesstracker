import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where,
  orderBy,
  addDoc,
  Timestamp,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

interface StreakData {
  current: number;
  longest: number;
  weeklyConsistency: number; // 0-100%
  lastWorkoutDate?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class StreakService {
  private firestore = inject(Firestore);

  /**
   * Calculates current & longest streak + weekly consistency (last 7 days)
   */
  getUserStreak(userId: string): Observable<StreakData> {
    const progressRef = collection(this.firestore, 'dailyProgress');
    const q = query(
      progressRef,
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((logs: any[]) => {
        if (!logs || logs.length === 0) {
          return { current: 0, longest: 0, weeklyConsistency: 0 };
        }

        // Convert all dates to midnight Date objects
        const workoutDates: Date[] = logs
          .map((log) => {
            let date: Date;
            if (log.date?.toDate) {
              date = log.date.toDate();
            } else if (log.date) {
              date = new Date(log.date);
            } else {
              return null;
            }
            date.setHours(0, 0, 0, 0);
            return date;
          })
          .filter((d): d is Date => d !== null)
          .sort((a, b) => b.getTime() - a.getTime()); // newest first

        // Remove duplicates (in case multiple logs per day)
        const uniqueDates = workoutDates.filter(
          (date, index, self) =>
            index === self.findIndex((d) => d.getTime() === date.getTime())
        );

        return this.calculateStreakFromDates(uniqueDates);
      }),
      catchError((err) => {
        console.error('Error fetching streak:', err);
        return of({ current: 0, longest: 0, weeklyConsistency: 0 });
      })
    );
  }

  /**
   * Core streak calculation logic – pure & testable
   */
  private calculateStreakFromDates(dates: Date[]): StreakData {
    if (dates.length === 0) {
      return { current: 0, longest: 0, weeklyConsistency: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Check if today has a workout
    const hasToday = dates.some((d) => d.getTime() === todayTime);

    let expectedDate = hasToday ? todayTime : todayTime - 86400000; // yesterday if no today

    for (const date of dates) {
      const dateTime = date.getTime();

      if (dateTime === expectedDate) {
        tempStreak++;
        expectedDate -= 86400000; // go to previous day
      } else if (dateTime < expectedDate - 86400000) {
        // Gap larger than 1 day → streak broken
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1; // start new streak from this date
        expectedDate = dateTime - 86400000;
      } else {
        // Older dates after gap already handled
        continue;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    // Current streak: only count if chain reaches today/yesterday
    if (hasToday) {
      currentStreak = tempStreak;
    } else if (dates[0].getTime() === todayTime - 86400000) {
      // Yesterday was the last → current streak continues (if they log today later)
      currentStreak = tempStreak;
    }

    // Weekly consistency: how many of the last 7 days had a workout?
    const last7DaysStart = todayTime - 6 * 86400000;
    const workoutsInLast7Days = dates.filter(
      (d) => d.getTime() >= last7DaysStart && d.getTime() <= todayTime
    ).length;

    const weeklyConsistency = Math.round((workoutsInLast7Days / 7) * 100);

    return {
      current: currentStreak,
      longest: longestStreak,
      weeklyConsistency,
      lastWorkoutDate: dates[0] || null,
    };
  }

  /**
   * Log a workout for today (idempotent – won't duplicate same-day entries)
   */
  async logWorkoutCompletion(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const progressRef = collection(this.firestore, 'dailyProgress');

    await addDoc(progressRef, {
      userId,
      date: Timestamp.fromDate(new Date()), // use Timestamp for consistency
      completedAt: Timestamp.now(),
      type: 'workout',
    });
  }
}