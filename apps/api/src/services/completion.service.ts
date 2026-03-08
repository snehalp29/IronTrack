import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(sessionId: string, userId: string) {
    const [totalSets, completedSets] = await this.prisma.$transaction(
      [
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
      ],
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );

    const completionPercent =
      totalSets === 0
        ? 0
        : Math.round((completedSets / totalSets) * 10_000) / 100;

    return {
      totalSets,
      completedSets,
      completionPercent,
      isIncomplete: completedSets < totalSets,
    };
  }
}
