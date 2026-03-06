const MAX_ESTIMATE_ONE_RM_REPS = 15;

export function estimateOneRm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0 || reps > MAX_ESTIMATE_ONE_RM_REPS) {
    return 0;
  }

  return weight * (1 + reps / 30);
}
