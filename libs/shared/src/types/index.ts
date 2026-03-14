import { ExerciseType } from '../enums';

export interface WorkoutSet {
  id?: string;
  type: ExerciseType;
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  isCompleted?: boolean;
}

export interface WorkoutSummary {
  totalVolume: number;
  durationSeconds: number;
  completedSets: number;
  totalSets: number;
}

export interface WeeklyCoverage {
  coveragePercent: number;
  coveredMuscles: number;
  totalMuscles: number;
}
