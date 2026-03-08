import { Injectable } from '@nestjs/common';
import { PrType, Prisma } from '@prisma/client';

import { estimateOneRm } from '../common/utils/one-rm';
import { PrismaService } from '../prisma/prisma.service';

interface ExerciseSetInput {
  id: string;
  exerciseTemplateId: string;
  sessionId: string | null;
  weight: number | null;
  reps: number | null;
  completedAt: Date | null;
}

type PrDetectionClient = PrismaService | Prisma.TransactionClient;
const PR_UPSERT_CHUNK_SIZE = 25;

@Injectable()
export class PrDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  async detectForSession(userId: string, sessionId: string) {
    let lastSerializableConflict: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.detectForSessionInTransaction(userId, sessionId, tx),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (!isSerializableTransactionConflict(error)) {
          throw error;
        }

        lastSerializableConflict = error;
      }
    }

    throw lastSerializableConflict instanceof Error
      ? lastSerializableConflict
      : new Error('Serializable transaction failed');
  }

  private async detectForSessionInTransaction(
    userId: string,
    sessionId: string,
    client: PrDetectionClient,
  ) {
    const sessionSets = await client.set.findMany({
      where: {
        isCompleted: true,
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
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
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

    const existingPrs = await client.pRRecord.findMany({
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
    const upserts: Array<() => Prisma.PrismaPromise<unknown>> = [];

    for (const [exerciseTemplateId, sets] of grouped.entries()) {
      const candidateMap = this.calculateCandidates(sets);
      for (const [prType, candidate] of candidateMap.entries()) {
        if (!candidate) {
          continue;
        }

        const prKey = this.getPrKey(exerciseTemplateId, prType);
        const existingValue = existingValueByKey.get(prKey);

        if (existingValue === undefined || candidate.value > existingValue) {
          upserts.push(() =>
            client.pRRecord.upsert({
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
      for (
        let index = 0;
        index < upserts.length;
        index += PR_UPSERT_CHUNK_SIZE
      ) {
        await Promise.all(
          upserts
            .slice(index, index + PR_UPSERT_CHUNK_SIZE)
            .map((createUpsert) => createUpsert()),
        );
      }
    }

    return createdPrs;
  }

  async recalculateForExercise(
    userId: string,
    exerciseTemplateId: string,
    client: PrDetectionClient = this.prisma,
  ) {
    const allSets = await client.set.findMany({
      where: {
        deletedAt: null,
        isCompleted: true,
        sessionExercise: {
          exerciseTemplateId,
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
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
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
    });

    const candidates = this.calculateCandidates(
      allSets.map((set) => ({
        ...set,
        exerciseTemplateId,
        sessionId: set.sessionExercise.sessionId,
      })),
    );
    const operations: Prisma.PrismaPromise<unknown>[] = [];
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
        client.pRRecord.upsert({
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
        client.pRRecord.deleteMany({
          where: {
            userId,
            exerciseTemplateId,
            prType: { in: nullPrTypes },
          },
        }),
      );
    }

    if (client === this.prisma) {
      await this.prisma.$transaction(operations);
      return;
    }

    for (const operation of operations) {
      await operation;
    }
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
      const oneRm = estimateOneRm(weight, reps);

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

function isSerializableTransactionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: unknown }).code === 'P2034';
}
