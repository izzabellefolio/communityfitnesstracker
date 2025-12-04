import { Exercise } from './exercise.model';
import { Timestamp } from 'firebase/firestore';

export interface Routine {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  schedule: string[];
  time: string;
  exercises: Exercise[];
  createdAt?: Date | Timestamp;
  isPremade?: boolean;
  isTemplate?: boolean;
  completedDates?: string[]; // ISO date strings of completed workout dates
}