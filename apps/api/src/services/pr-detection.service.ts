import { Injectable } from '@nestjs/common';
import { PrType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

interface ExerciseSetInput {
  id: string;
  exerciseTemplateId: string;
  weight: number | null;
  reps: number | null;
  completedAt: Date | null;
}

@Injectable()
export class PrDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  async detectForSession(userId: string, sessionId: string) {
    const sessionSets = await this.prisma.set.findMany({
      where: {
        isCompleted: true,
        deletedAt: null,
        sessionExercise: {
          sessionId,
          session: {
            userId,
          },
        },
      },
      select: {
        id: true,
        weight: true,
        reps: true,
        completedAt: true,
        sessionExercise: {
          select: {
            exerciseTemplateId: true,
          },
        },
      },
    });

    const grouped = new Map<string, ExerciseSetInput[]>();
    for (const set of sessionSets) {
      const exerciseTemplateId = set.sessionExercise.exerciseTemplateId;
      const record: ExerciseSetInput = {
        id: set.id,
        exerciseTemplateId,
        weight: set.weight,
        reps: set.reps,
        completedAt: set.completedAt,
      };
      grouped.set(exerciseTemplateId, [
        ...(grouped.get(exerciseTemplateId) ?? []),
        record,
      ]);
    }

    const createdPrs = [] as Array<{
      exerciseTemplateId: string;
      prType: PrType;
      value: number;
    }>;

    for (const [exerciseTemplateId, sets] of grouped.entries()) {
      const candidateMap = this.calculateCandidates(sets);
      for (const [prType, candidate] of candidateMap.entries()) {
        if (!candidate) {
          continue;
        }

        const existing = await this.prisma.pRRecord.findUnique({
          where: {
            userId_exerciseTemplateId_prType: {
              userId,
              exerciseTemplateId,
              prType,
            },
          },
        });

        if (!existing || candidate.value > existing.value) {
          await this.prisma.pRRecord.upsert({
            where: {
              userId_exerciseTemplateId_prType: {
                userId,
                exerciseTemplateId,
                prType,
              },
            },
            update: {
              value: candidate.value,
              achievedAt: candidate.achievedAt,
              setId: candidate.setId,
              sessionId,
            },
            create: {
              userId,
              exerciseTemplateId,
              prType,
              value: candidate.value,
              achievedAt: candidate.achievedAt,
              setId: candidate.setId,
              sessionId,
            },
          });

          createdPrs.push({
            exerciseTemplateId,
            prType,
            value: candidate.value,
          });
        }
      }
    }

    return createdPrs;
  }

  async recalculateForExercise(userId: string, exerciseTemplateId: string) {
    const allSets = await this.prisma.set.findMany({
      where: {
        deletedAt: null,
        isCompleted: true,
        sessionExercise: {
          exerciseTemplateId,
          session: {
            userId,
          },
        },
      },
      select: {
        id: true,
        weight: true,
        reps: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'asc' },
    });

    const candidates = this.calculateCandidates(
      allSets.map((set) => ({ ...set, exerciseTemplateId })),
    );

    for (const prType of [
      PrType.MAX_WEIGHT,
      PrType.MAX_REPS,
      PrType.MAX_VOLUME,
      PrType.MAX_1RM_EST,
    ]) {
      const candidate = candidates.get(prType);
      if (!candidate) {
        continue;
      }

      await this.prisma.pRRecord.upsert({
        where: {
          userId_exerciseTemplateId_prType: {
            userId,
            exerciseTemplateId,
            prType,
          },
        },
        update: {
          value: candidate.value,
          achievedAt: candidate.achievedAt,
          setId: candidate.setId,
        },
        create: {
          userId,
          exerciseTemplateId,
          prType,
          value: candidate.value,
          achievedAt: candidate.achievedAt,
          setId: candidate.setId,
        },
      });
    }
  }

  private calculateCandidates(sets: ExerciseSetInput[]) {
    const candidates = new Map<
      PrType,
      { value: number; achievedAt: Date; setId: string } | null
    >([
      [PrType.MAX_WEIGHT, null],
      [PrType.MAX_REPS, null],
      [PrType.MAX_VOLUME, null],
      [PrType.MAX_1RM_EST, null],
    ]);

    for (const set of sets) {
      const achievedAt = set.completedAt ?? new Date();
      const weight = set.weight ?? 0;
      const reps = set.reps ?? 0;
      const volume = weight * reps;
      const oneRm = weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;

      this.replaceIfHigher(
        candidates,
        PrType.MAX_WEIGHT,
        weight,
        achievedAt,
        set.id,
      );
      this.replaceIfHigher(
        candidates,
        PrType.MAX_REPS,
        reps,
        achievedAt,
        set.id,
      );
      this.replaceIfHigher(
        candidates,
        PrType.MAX_VOLUME,
        volume,
        achievedAt,
        set.id,
      );
      this.replaceIfHigher(
        candidates,
        PrType.MAX_1RM_EST,
        oneRm,
        achievedAt,
        set.id,
      );
    }

    return candidates;
  }

  private replaceIfHigher(
    candidates: Map<
      PrType,
      { value: number; achievedAt: Date; setId: string } | null
    >,
    key: PrType,
    value: number,
    achievedAt: Date,
    setId: string,
  ) {
    if (value <= 0) {
      return;
    }

    const current = candidates.get(key);
    if (!current || value > current.value) {
      candidates.set(key, { value, achievedAt, setId });
    }
  }
}
