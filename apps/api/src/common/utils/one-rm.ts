export function estimateOneRm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }

  return weight * (1 + reps / 30);
}
