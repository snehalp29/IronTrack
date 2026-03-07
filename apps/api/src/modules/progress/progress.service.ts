import { BadRequestException, Injectable } from '@nestjs/common';

import { startOfWeek } from '../../common/utils/dates';
import { calculateSetVolume } from '../../common/utils/volume';
import { isIsoDateOnly } from '../../common/validation/iso-date-only';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProgressService {
  private totalMuscleCountCache:
    | {
        expiresAtMs: number;
        promise: Promise<number>;
      }
    | undefined;

  constructor(private readonly prisma: PrismaService) {}

  async weekly(userId: string, startDate?: string) {
    const start = this.resolveWeekStart(startDate);
    const endExclusive = new Date(start);
    endExclusive.setUTCDate(start.getUTCDate() + 7);
    const endInclusive = new Date(start);
    endInclusive.setUTCDate(start.getUTCDate() + 6);
    endInclusive.setUTCHours(23, 59, 59, 999);

    const sets = await this.prisma.set.findMany({
      where: {
        deletedAt: null,
        isCompleted: true,
        completedAt: {
          gte: start,
          lt: endExclusive,
        },
        sessionExercise: {
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
            status: 'FINISHED',
          },
        },
      },
      select: {
        weight: true,
        reps: true,
        sessionExercise: {
          select: {
            exercise: {
              select: {
                primaryMuscle: { select: { id: true, name: true } },
                secondaryMuscles: {
                  select: { muscleGroup: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    });

    const muscleVolumeMap = new Map<
      string,
      { id: string; name: string; volume: number }
    >();
    const coveredMuscleIds = new Set<string>();

    for (const set of sets) {
      const volume = calculateSetVolume({
        weight: set.weight,
        reps: set.reps,
        durationSeconds: null,
      });
      const primary = set.sessionExercise.exercise.primaryMuscle;
      const appliedSecondaryMuscleIds = new Set<string>();

      coveredMuscleIds.add(primary.id);
      muscleVolumeMap.set(primary.id, {
        id: primary.id,
        name: primary.name,
        volume: (muscleVolumeMap.get(primary.id)?.volume ?? 0) + volume,
      });

      for (const secondary of set.sessionExercise.exercise.secondaryMuscles) {
        const muscle = secondary.muscleGroup;
        if (
          muscle.id === primary.id ||
          appliedSecondaryMuscleIds.has(muscle.id)
        ) {
          continue;
        }
        appliedSecondaryMuscleIds.add(muscle.id);

        coveredMuscleIds.add(muscle.id);
        muscleVolumeMap.set(muscle.id, {
          id: muscle.id,
          name: muscle.name,
          volume: (muscleVolumeMap.get(muscle.id)?.volume ?? 0) + volume * 0.5,
        });
      }
    }

    const totalMuscles = await this.getTotalMuscles();
    const coveragePercent = totalMuscles
      ? (coveredMuscleIds.size / totalMuscles) * 100
      : 0;

    return {
      weekStart: start,
      weekEnd: endInclusive,
      coveragePercent,
      coveredMuscles: coveredMuscleIds.size,
      totalMuscles,
      perMuscleVolume: Array.from(muscleVolumeMap.values()).sort(
        (a, b) => b.volume - a.volume,
      ),
    };
  }

  private resolveWeekStart(startDate?: string): Date {
    if (!startDate) {
      return startOfWeek(new Date());
    }

    if (!isIsoDateOnly(startDate)) {
      throw new BadRequestException({
        code: 'INVALID_START_DATE',
        message: 'Invalid startDate',
      });
    }

    return startOfWeek(new Date(`${startDate}T00:00:00.000Z`));
  }

  private getTotalMuscles() {
    const now = Date.now();

    if (
      !this.totalMuscleCountCache ||
      this.totalMuscleCountCache.expiresAtMs <= now
    ) {
      const promise = this.prisma.muscleGroup
        .count()
        .catch((error: unknown) => {
          this.totalMuscleCountCache = undefined;
          throw error;
        });
      this.totalMuscleCountCache = {
        expiresAtMs: now + 5 * 60 * 1000,
        promise,
      };
    }

    return this.totalMuscleCountCache.promise;
  }
}
