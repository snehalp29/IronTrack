import { WorkoutSet } from '../types';

export function calculateSetVolume(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds'>,
): number {
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;

  if (weight > 0 && reps > 0) {
    return weight * reps;
  }

  return set.durationSeconds ?? 0;
}

export function calculateTotalVolume(
  sets: Array<Pick<WorkoutSet, 'weight' | 'reps' | 'durationSeconds'>>,
): number {
  return sets.reduce((sum, set) => sum + calculateSetVolume(set), 0);
}
