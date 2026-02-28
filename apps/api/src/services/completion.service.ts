import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(sessionId: string) {
    const [totalSets, completedSets] = await this.prisma.$transaction([
      this.prisma.set.count({
        where: {
          deletedAt: null,
          sessionExercise: { sessionId },
        },
      }),
      this.prisma.set.count({
        where: {
          deletedAt: null,
          isCompleted: true,
          sessionExercise: { sessionId },
        },
      }),
    ]);

    const completionPercent =
      totalSets === 0 ? 0 : (completedSets / totalSets) * 100;

    return {
      totalSets,
      completedSets,
      completionPercent,
      isIncomplete: completedSets < totalSets,
    };
  }
}
