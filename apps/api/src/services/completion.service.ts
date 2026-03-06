import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(sessionId: string, userId: string) {
    const [totalSets, completedSets] = await this.prisma.$transaction([
      this.prisma.set.count({
        where: {
          deletedAt: null,
          sessionExercise: {
            sessionId,
            deletedAt: null,
            session: {
              userId,
              deletedAt: null,
            },
          },
        },
      }),
      this.prisma.set.count({
        where: {
          deletedAt: null,
          isCompleted: true,
          sessionExercise: {
            sessionId,
            deletedAt: null,
            session: {
              userId,
              deletedAt: null,
            },
          },
        },
      }),
    ]);

    const completionPercent =
      totalSets === 0
        ? 0
        : Math.round(
            ((completedSets / totalSets) * 100 + Number.EPSILON) * 100,
          ) / 100;

    return {
      totalSets,
      completedSets,
      completionPercent,
      isIncomplete: completedSets < totalSets,
    };
  }
}
