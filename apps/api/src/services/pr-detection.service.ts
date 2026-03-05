import { Injectable } from '@nestjs/common';
import { PrType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

interface ExerciseSetInput {
  id: string;
  exerciseTemplateId: string;
  sessionId: string | null;
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
        sessionId,
        weight: set.weight,
        reps: set.reps,
        completedAt: set.completedAt,
      };
      const existingGroup = grouped.get(exerciseTemplateId);
      if (existingGroup) {
        existingGroup.push(record);
      } else {
        grouped.set(exerciseTemplateId, [record]);
      }
    }

    const createdPrs = [] as Array<{
      exerciseTemplateId: string;
      prType: PrType;
      value: number;
    }>;
    const trackedPrTypes = [
      PrType.MAX_WEIGHT,
      PrType.MAX_REPS,
      PrType.MAX_VOLUME,
      PrType.MAX_1RM_EST,
    ] as const;
    const exerciseTemplateIds = Array.from(grouped.keys());

    if (!exerciseTemplateIds.length) {
      return createdPrs;
    }

    const existingPrs = await this.prisma.pRRecord.findMany({
      where: {
        userId,
        exerciseTemplateId: { in: exerciseTemplateIds },
        prType: { in: [...trackedPrTypes] },
      },
      select: {
        exerciseTemplateId: true,
        prType: true,
        value: true,
      },
    });
    const existingValueByKey = new Map(
      existingPrs.map((record) => [
        this.getPrKey(record.exerciseTemplateId, record.prType),
        record.value,
      ]),
    );
    const upserts: Array<ReturnType<typeof this.prisma.pRRecord.upsert>> = [];

    for (const [exerciseTemplateId, sets] of grouped.entries()) {
      const candidateMap = this.calculateCandidates(sets);
      for (const [prType, candidate] of candidateMap.entries()) {
        if (!candidate) {
          continue;
        }

        const prKey = this.getPrKey(exerciseTemplateId, prType);
        const existingValue = existingValueByKey.get(prKey);

        if (existingValue === undefined || candidate.value > existingValue) {
          upserts.push(
            this.prisma.pRRecord.upsert({
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
            }),
          );
          existingValueByKey.set(prKey, candidate.value);

          createdPrs.push({
            exerciseTemplateId,
            prType,
            value: candidate.value,
          });
        }
      }
    }

    if (upserts.length > 0) {
      await this.prisma.$transaction(upserts);
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
        sessionExercise: {
          select: {
            sessionId: true,
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    const candidates = this.calculateCandidates(
      allSets.map((set) => ({
        ...set,
        exerciseTemplateId,
        sessionId: set.sessionExercise.sessionId,
      })),
    );
    const operations: Array<
      | ReturnType<typeof this.prisma.pRRecord.upsert>
      | ReturnType<typeof this.prisma.pRRecord.deleteMany>
    > = [];
    const nullPrTypes: PrType[] = [];

    for (const prType of [
      PrType.MAX_WEIGHT,
      PrType.MAX_REPS,
      PrType.MAX_VOLUME,
      PrType.MAX_1RM_EST,
    ]) {
      const candidate = candidates.get(prType);
      if (!candidate) {
        nullPrTypes.push(prType);
        continue;
      }

      operations.push(
        this.prisma.pRRecord.upsert({
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
            sessionId: candidate.sessionId,
          },
          create: {
            userId,
            exerciseTemplateId,
            prType,
            value: candidate.value,
            achievedAt: candidate.achievedAt,
            setId: candidate.setId,
            sessionId: candidate.sessionId,
          },
        }),
      );
    }

    if (nullPrTypes.length > 0) {
      operations.push(
        this.prisma.pRRecord.deleteMany({
          where: {
            userId,
            exerciseTemplateId,
            prType: { in: nullPrTypes },
          },
        }),
      );
    }

    await this.prisma.$transaction(operations);
  }

  private calculateCandidates(sets: ExerciseSetInput[]) {
    const candidates = new Map<
      PrType,
      {
        value: number;
        achievedAt: Date;
        setId: string;
        sessionId: string | null;
      } | null
    >([
      [PrType.MAX_WEIGHT, null],
      [PrType.MAX_REPS, null],
      [PrType.MAX_VOLUME, null],
      [PrType.MAX_1RM_EST, null],
    ]);

    for (const set of sets) {
      // Completed sets without completedAt are a data integrity issue.
      // Skip these rows instead of inventing an incorrect timestamp.
      if (!set.completedAt) {
        continue;
      }

      const achievedAt = set.completedAt;
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
        set.sessionId,
      );
      this.replaceIfHigher(
        candidates,
        PrType.MAX_REPS,
        reps,
        achievedAt,
        set.id,
        set.sessionId,
      );
      this.replaceIfHigher(
        candidates,
        PrType.MAX_VOLUME,
        volume,
        achievedAt,
        set.id,
        set.sessionId,
      );
      this.replaceIfHigher(
        candidates,
        PrType.MAX_1RM_EST,
        oneRm,
        achievedAt,
        set.id,
        set.sessionId,
      );
    }

    return candidates;
  }

  private replaceIfHigher(
    candidates: Map<
      PrType,
      {
        value: number;
        achievedAt: Date;
        setId: string;
        sessionId: string | null;
      } | null
    >,
    key: PrType,
    value: number,
    achievedAt: Date,
    setId: string,
    sessionId: string | null,
  ) {
    if (value <= 0) {
      return;
    }

    const current = candidates.get(key);
    if (!current || value > current.value) {
      candidates.set(key, { value, achievedAt, setId, sessionId });
    }
  }

  private getPrKey(exerciseTemplateId: string, prType: PrType): string {
    return `${exerciseTemplateId}:${prType}`;
  }
}
