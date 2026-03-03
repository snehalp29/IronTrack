import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type VolumeSetInput = {
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
};

export function calculateSetVolumeValue(set: VolumeSetInput): number {
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;

  if (weight > 0 && reps > 0) {
    return weight * reps;
  }

  return set.durationSeconds ?? 0;
}

@Injectable()
export class VolumeService {
  constructor(private readonly prisma: PrismaService) {}

  calculateSetVolume(set: VolumeSetInput): number {
    return calculateSetVolumeValue(set);
  }

  async calculateSessionVolume(sessionId: string): Promise<number> {
    const sets = await this.prisma.set.findMany({
      where: {
        deletedAt: null,
        isCompleted: true,
        sessionExercise: {
          sessionId,
        },
      },
      select: {
        weight: true,
        reps: true,
        durationSeconds: true,
      },
    });

    return sets.reduce((sum, set) => sum + this.calculateSetVolume(set), 0);
  }

  async cacheSessionVolume(sessionId: string): Promise<number> {
    const totalVolume = await this.calculateSessionVolume(sessionId);

    await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: { totalVolume },
    });

    return totalVolume;
  }
}
