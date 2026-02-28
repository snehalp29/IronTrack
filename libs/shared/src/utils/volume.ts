import { WorkoutSet } from '../types';

export function calculateSetVolume(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds'>,
): number {
  if ((set.weight ?? 0) > 0 && (set.reps ?? 0) > 0) {
    return (set.weight ?? 0) * (set.reps ?? 0);
  }

  return set.durationSeconds ?? 0;
}

export function calculateTotalVolume(
  sets: Array<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds'>>,
): number {
  return sets.reduce((sum, set) => sum + calculateSetVolume(set), 0);
}
