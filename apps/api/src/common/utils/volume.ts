export type VolumeSetInput = {
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
};

export function calculateSetVolume(set: VolumeSetInput): number {
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;

  if (weight > 0 && reps > 0) {
    return weight * reps;
  }

  return set.durationSeconds ?? 0;
}
