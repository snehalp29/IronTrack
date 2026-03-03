import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async weekly(userId: string, startDate?: string) {
    const start = startDate
      ? new Date(`${startDate}T00:00:00.000Z`)
      : this.startOfWeek(new Date());
    const endExclusive = new Date(start);
    endExclusive.setUTCDate(start.getUTCDate() + 7);
    const endInclusive = new Date(endExclusive.getTime() - 1);

    const sets = await this.prisma.set.findMany({
      where: {
        deletedAt: null,
        isCompleted: true,
        sessionExercise: {
          session: {
            userId,
            startedAt: {
              gte: start,
              lt: endExclusive,
            },
          },
        },
      },
      select: {
        weight: true,
        reps: true,
        durationSeconds: true,
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
      const volume = this.calculateSetVolume(set);
      const primary = set.sessionExercise.exercise.primaryMuscle;

      coveredMuscleIds.add(primary.id);
      muscleVolumeMap.set(primary.id, {
        id: primary.id,
        name: primary.name,
        volume: (muscleVolumeMap.get(primary.id)?.volume ?? 0) + volume,
      });

      for (const secondary of set.sessionExercise.exercise.secondaryMuscles) {
        const muscle = secondary.muscleGroup;
        coveredMuscleIds.add(muscle.id);
        muscleVolumeMap.set(muscle.id, {
          id: muscle.id,
          name: muscle.name,
          volume: (muscleVolumeMap.get(muscle.id)?.volume ?? 0) + volume * 0.5,
        });
      }
    }

    const totalMuscles = await this.prisma.muscleGroup.count();
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

  private startOfWeek(date: Date): Date {
    const copy = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = copy.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setUTCDate(copy.getUTCDate() + diff);
    return copy;
  }

  private calculateSetVolume(set: {
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
}
