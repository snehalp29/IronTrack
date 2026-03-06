import { Injectable } from '@nestjs/common';

import { calculateSetVolume } from '../common/utils/volume';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VolumeService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateSessionVolume(sessionId: string): Promise<number> {
    const sets = await this.prisma.set.findMany({
      where: {
        deletedAt: null,
        isCompleted: true,
        sessionExercise: {
          sessionId,
          deletedAt: null,
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

  async cacheSessionVolume(sessionId: string): Promise<number> {
    const totalVolume = await this.calculateSessionVolume(sessionId);

    await this.prisma.workoutSession.updateMany({
      where: { id: sessionId },
      data: { totalVolume },
    });

    return totalVolume;
  }
}
