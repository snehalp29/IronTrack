import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VolumeService {
  constructor(private readonly prisma: PrismaService) {}

  calculateSetVolume(set: {
    weight: number | null;
    reps: number | null;
    durationSeconds: number | null;
  }): number {
    if (set.weight && set.reps) {
      return set.weight * set.reps;
    }

    if (set.durationSeconds) {
      return set.durationSeconds;
    }

    return 0;
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
