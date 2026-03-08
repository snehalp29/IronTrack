import { Injectable } from '@nestjs/common';

import { calculateSetVolume } from '../common/utils/volume';
import { PrismaService } from '../prisma/prisma.service';

type VolumeClient = Pick<PrismaService, 'set' | 'workoutSession'>;

@Injectable()
export class VolumeService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateSessionVolume(
    sessionId: string,
    userId: string,
    client: VolumeClient = this.prisma,
  ): Promise<number> {
    const sets = await client.set.findMany({
      where: {
        deletedAt: null,
        isCompleted: true,
        sessionExercise: {
          sessionId,
          deletedAt: null,
          session: {
            deletedAt: null,
            userId,
          },
        },
      },
      select: {
        weight: true,
        reps: true,
        durationSeconds: true,
      },
    });

    return sets.reduce((sum, set) => sum + calculateSetVolume(set), 0);
  }

  async cacheSessionVolume(sessionId: string, userId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const totalVolume = await this.calculateSessionVolume(
        sessionId,
        userId,
        tx,
      );

      await tx.workoutSession.updateMany({
        where: {
          id: sessionId,
          userId,
          deletedAt: null,
        },
        data: { totalVolume },
      });

      return totalVolume;
    });
  }
}
