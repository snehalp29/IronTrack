import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CompletionService } from '../../services/completion.service';
import { PrDetectionService } from '../../services/pr-detection.service';
import { StreakService } from '../../services/streak.service';
import { SupersetService } from '../../services/superset.service';
import { VolumeService } from '../../services/volume.service';
import {
  AddSessionExerciseDto,
  BatchCreateSetsDto,
  CreateSetDto,
  ListSessionsQuery,
  ReorderSessionExercisesDto,
  StartSessionDto,
  SwapSessionExerciseDto,
  ToggleSetCompletionDto,
  UpdateSessionDto,
  UpdateSessionExerciseDto,
  UpdateSetDto,
} from './dto/session.schemas';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prDetectionService: PrDetectionService,
    private readonly volumeService: VolumeService,
    private readonly streakService: StreakService,
    private readonly completionService: CompletionService,
    private readonly supersetService: SupersetService,
  ) {}

  async startSession(userId: string, input: StartSessionDto) {
    const templateExercises = input.workoutTemplateId
      ? await this.prisma.workoutTemplateExercise.findMany({
          where: {
            workoutTemplateId: input.workoutTemplateId,
            template: { userId, deletedAt: null },
          },
          orderBy: { orderIndex: 'asc' },
        })
      : [];

    const sessionExerciseCreates = input.workoutTemplateId
      ? templateExercises.map((exercise, index) => ({
          exerciseTemplateId: exercise.exerciseTemplateId,
          orderIndex: exercise.orderIndex ?? index,
          notes: null,
          supersetGroupKey: exercise.supersetGroupKey,
        }))
      : (input.exercises ?? []).map((exercise, index) => ({
          exerciseTemplateId: exercise.exerciseTemplateId,
          orderIndex: exercise.orderIndex ?? index,
          notes: exercise.notes,
          supersetGroupKey: exercise.supersetGroupKey,
        }));

    const session = await this.prisma.workoutSession.create({
      data: {
        userId,
        workoutTemplateId: input.workoutTemplateId,
        notes: input.notes,
        sessionExercises: {
          create: sessionExerciseCreates,
        },
      },
      include: {
        sessionExercises: {
          include: {
            exercise: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return session;
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
      include: {
        sessionExercises: {
          where: { deletedAt: null },
          include: {
            exercise: true,
            sets: {
              where: { deletedAt: null },
              orderBy: { orderIndex: 'asc' },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    const interleavedExercises = this.supersetService.interleave(
      session.sessionExercises.map((exercise) => ({
        supersetGroupKey: exercise.supersetGroupKey,
        orderIndex: exercise.orderIndex,
        item: exercise,
      })),
    );

    return {
      ...session,
      sessionExercises: interleavedExercises,
    };
  }

  async updateSession(
    userId: string,
    sessionId: string,
    input: UpdateSessionDto,
  ) {
    const existing = await this.prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (existing.version !== input.version) {
      throw new ConflictException({
        code: 'SESSION_VERSION_CONFLICT',
        message: 'Session was updated elsewhere. Refresh and try again.',
        details: {
          expectedVersion: existing.version,
          incomingVersion: input.version,
        },
      });
    }

    return this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        notes: input.notes,
        endedReason: input.endedReason,
        version: { increment: 1 },
      },
    });
  }

  async finishSession(userId: string, sessionId: string) {
    const existing = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    const finishedAt = new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((finishedAt.getTime() - existing.startedAt.getTime()) / 1000),
    );

    const session = await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: 'FINISHED',
        finishedAt,
        endedReason: existing.endedReason ?? 'USER_ENDED',
        durationSeconds,
        version: { increment: 1 },
      },
    });

    const totalVolume = await this.volumeService.cacheSessionVolume(session.id);
    const newPrs = await this.prDetectionService.detectForSession(
      userId,
      session.id,
    );
    await this.streakService.onSessionFinished(userId);
    const completion = await this.completionService.calculate(session.id);

    return {
      ...session,
      totalVolume,
      newPrs,
      completion,
      warning: completion.isIncomplete ? 'Workout has incomplete sets' : null,
    };
  }

  async listSessions(userId: string, query: ListSessionsQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const where = {
      userId,
      deletedAt: null,
      workoutTemplateId: query.templateId,
      startedAt:
        query.startDate || query.endDate
          ? {
              gte: query.startDate ? new Date(query.startDate) : undefined,
              lte: query.endDate ? new Date(query.endDate) : undefined,
            }
          : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workoutSession.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { startedAt: 'desc' },
        include: {
          workoutTemplate: true,
        },
      }),
      this.prisma.workoutSession.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
  }

  async getActiveSession(userId: string) {
    return this.prisma.workoutSession.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS',
        deletedAt: null,
      },
      orderBy: { startedAt: 'desc' },
      include: {
        sessionExercises: {
          where: { deletedAt: null },
          include: {
            exercise: true,
            sets: {
              where: { deletedAt: null },
              orderBy: { orderIndex: 'asc' },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async softDeleteSession(userId: string, sessionId: string) {
    const updated = await this.prisma.workoutSession.updateMany({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (!updated.count) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    return { success: true };
  }

  async addSessionExercise(
    userId: string,
    sessionId: string,
    input: AddSessionExerciseDto,
  ) {
    await this.assertSessionOwnership(userId, sessionId);

    return this.prisma.sessionExercise.create({
      data: {
        sessionId,
        exerciseTemplateId: input.exerciseTemplateId,
        orderIndex: input.orderIndex,
        notes: input.notes,
        supersetGroupKey: input.supersetGroupKey,
      },
    });
  }

  async updateSessionExercise(
    userId: string,
    sessionId: string,
    sessionExerciseId: string,
    input: UpdateSessionExerciseDto,
  ) {
    const target = await this.prisma.sessionExercise.findFirst({
      where: {
        id: sessionExerciseId,
        sessionId,
        deletedAt: null,
        session: { userId },
      },
    });

    if (!target) {
      throw new NotFoundException({
        code: 'SESSION_EXERCISE_NOT_FOUND',
        message: 'Session exercise not found',
      });
    }

    if (input.version && target.version !== input.version) {
      throw new ConflictException({
        code: 'SESSION_EXERCISE_VERSION_CONFLICT',
        message: 'Session exercise changed elsewhere',
      });
    }

    return this.prisma.sessionExercise.update({
      where: { id: target.id },
      data: {
        notes: input.notes,
        supersetGroupKey: input.supersetGroupKey,
        orderIndex: input.orderIndex,
        version: { increment: 1 },
      },
    });
  }

  async deleteSessionExercise(
    userId: string,
    sessionId: string,
    sessionExerciseId: string,
  ) {
    const updated = await this.prisma.sessionExercise.updateMany({
      where: {
        id: sessionExerciseId,
        sessionId,
        session: { userId },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (!updated.count) {
      throw new NotFoundException({
        code: 'SESSION_EXERCISE_NOT_FOUND',
        message: 'Session exercise not found',
      });
    }

    return { success: true };
  }

  async reorderSessionExercises(
    userId: string,
    sessionId: string,
    input: ReorderSessionExercisesDto,
  ) {
    await this.assertSessionOwnership(userId, sessionId);

    await this.prisma.$transaction(
      input.items.map((item) =>
        this.prisma.sessionExercise.updateMany({
          where: {
            id: item.id,
            sessionId,
            deletedAt: null,
          },
          data: {
            orderIndex: item.orderIndex,
          },
        }),
      ),
    );

    return { success: true };
  }

  async swapSessionExercise(
    userId: string,
    sessionId: string,
    input: SwapSessionExerciseDto,
  ) {
    const exercise = await this.prisma.sessionExercise.findFirst({
      where: {
        id: input.fromExerciseId,
        sessionId,
        session: { userId },
        deletedAt: null,
      },
    });

    if (!exercise) {
      throw new NotFoundException({
        code: 'SESSION_EXERCISE_NOT_FOUND',
        message: 'Session exercise not found',
      });
    }

    return this.prisma.sessionExercise.update({
      where: { id: exercise.id },
      data: {
        exerciseTemplateId: input.toExerciseTemplateId,
        version: { increment: 1 },
      },
    });
  }

  async createSet(
    userId: string,
    sessionExerciseId: string,
    input: CreateSetDto,
  ) {
    const sessionExercise = await this.prisma.sessionExercise.findFirst({
      where: {
        id: sessionExerciseId,
        deletedAt: null,
        session: { userId },
      },
    });

    if (!sessionExercise) {
      throw new NotFoundException({
        code: 'SESSION_EXERCISE_NOT_FOUND',
        message: 'Session exercise not found',
      });
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.set.findFirst({
        where: {
          sessionExerciseId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) {
        return existing;
      }
    }

    const createdSet = await this.prisma.set.create({
      data: {
        sessionExerciseId,
        orderIndex: input.orderIndex,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        isCompleted: input.isCompleted ?? Boolean(input.completedAt),
        completedAt: input.completedAt
          ? new Date(input.completedAt)
          : input.isCompleted
            ? new Date()
            : null,
        idempotencyKey: input.idempotencyKey,
        weight: input.weight,
        reps: input.reps,
        durationSeconds: input.durationSeconds,
        rpe: input.rpe,
      },
      include: {
        sessionExercise: {
          select: {
            exerciseTemplateId: true,
            session: {
              select: {
                id: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (createdSet.isCompleted) {
      await this.prDetectionService.recalculateForExercise(
        createdSet.sessionExercise.session.userId,
        createdSet.sessionExercise.exerciseTemplateId,
      );
    }

    return createdSet;
  }

  async updateSet(
    userId: string,
    sessionExerciseId: string,
    setId: string,
    input: UpdateSetDto,
  ) {
    const existing = await this.prisma.set.findFirst({
      where: {
        id: setId,
        sessionExerciseId,
        deletedAt: null,
        sessionExercise: {
          session: { userId },
        },
      },
      include: {
        sessionExercise: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SET_NOT_FOUND',
        message: 'Set not found',
      });
    }

    const updateData: Prisma.SetUpdateInput = {
      orderIndex: input.orderIndex,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue | undefined,
      idempotencyKey: input.idempotencyKey,
      weight: input.weight,
      reps: input.reps,
      durationSeconds: input.durationSeconds,
      rpe: input.rpe,
    };

    if (input.isCompleted !== undefined) {
      updateData.isCompleted = input.isCompleted;
      updateData.completedAt = input.isCompleted
        ? input.completedAt
          ? new Date(input.completedAt)
          : new Date()
        : null;
    } else if (input.completedAt !== undefined) {
      updateData.isCompleted = true;
      updateData.completedAt = new Date(input.completedAt);
    }

    const updated = await this.prisma.set.update({
      where: { id: setId },
      data: updateData,
      include: {
        sessionExercise: true,
      },
    });

    await this.prDetectionService.recalculateForExercise(
      userId,
      existing.sessionExercise.exerciseTemplateId,
    );

    if (existing.sessionExercise.session.status === 'FINISHED') {
      await this.volumeService.cacheSessionVolume(
        existing.sessionExercise.session.id,
      );
    }

    return updated;
  }

  async deleteSet(userId: string, sessionExerciseId: string, setId: string) {
    const existing = await this.prisma.set.findFirst({
      where: {
        id: setId,
        sessionExerciseId,
        deletedAt: null,
        sessionExercise: {
          session: { userId },
        },
      },
      include: {
        sessionExercise: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SET_NOT_FOUND',
        message: 'Set not found',
      });
    }

    await this.prisma.set.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await this.prDetectionService.recalculateForExercise(
      userId,
      existing.sessionExercise.exerciseTemplateId,
    );

    if (existing.sessionExercise.session.status === 'FINISHED') {
      await this.volumeService.cacheSessionVolume(
        existing.sessionExercise.session.id,
      );
    }

    return { success: true };
  }

  async toggleSetCompletion(
    userId: string,
    sessionExerciseId: string,
    setId: string,
    input: ToggleSetCompletionDto,
  ) {
    const existing = await this.prisma.set.findFirst({
      where: {
        id: setId,
        sessionExerciseId,
        deletedAt: null,
        sessionExercise: {
          session: {
            userId,
          },
        },
      },
      include: {
        sessionExercise: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SET_NOT_FOUND',
        message: 'Set not found',
      });
    }

    const updated = await this.prisma.set.update({
      where: { id: setId },
      data: {
        isCompleted: input.isCompleted,
        completedAt: input.isCompleted ? new Date() : null,
      },
    });

    await this.prDetectionService.recalculateForExercise(
      userId,
      existing.sessionExercise.exerciseTemplateId,
    );

    return updated;
  }

  async batchCreateSets(
    userId: string,
    sessionExerciseId: string,
    input: BatchCreateSetsDto,
  ) {
    await this.assertSessionExerciseOwnership(userId, sessionExerciseId);

    const results = [];
    for (const set of input.sets) {
      const created = await this.createSet(userId, sessionExerciseId, set);
      results.push(created);
    }

    return {
      items: results,
      count: results.length,
    };
  }

  private async assertSessionOwnership(userId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
    });

    if (!session) {
      throw new ForbiddenException({
        code: 'SESSION_FORBIDDEN',
        message: 'Session not found or inaccessible',
      });
    }
  }

  private async assertSessionExerciseOwnership(
    userId: string,
    sessionExerciseId: string,
  ) {
    const sessionExercise = await this.prisma.sessionExercise.findFirst({
      where: {
        id: sessionExerciseId,
        deletedAt: null,
        session: {
          userId,
          deletedAt: null,
        },
      },
    });

    if (!sessionExercise) {
      throw new ForbiddenException({
        code: 'SESSION_EXERCISE_FORBIDDEN',
        message: 'Session exercise not found or inaccessible',
      });
    }
  }
}
