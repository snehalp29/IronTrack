import {
  BadRequestException,
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
    if (input.workoutTemplateId) {
      await this.assertWorkoutTemplateOwnership(
        userId,
        input.workoutTemplateId,
      );
    } else if (input.exercises.length > 0) {
      await this.assertExerciseTemplatesAccessible(
        userId,
        input.exercises.map((exercise) => exercise.exerciseTemplateId),
      );
    }

    const templateExercises = input.workoutTemplateId
      ? await this.prisma.workoutTemplateExercise.findMany({
          where: {
            workoutTemplateId: input.workoutTemplateId,
            exercise: {
              deletedAt: null,
            },
          },
          orderBy: { orderIndex: 'asc' },
        })
      : [];
    if (input.workoutTemplateId && templateExercises.length === 0) {
      this.throwTemplateForbidden();
    }

    const sessionExerciseCreates = input.workoutTemplateId
      ? templateExercises.map((exercise, index) => ({
          exerciseTemplateId: exercise.exerciseTemplateId,
          orderIndex: exercise.orderIndex ?? index,
          notes: null,
          supersetGroupKey: exercise.supersetGroupKey,
        }))
      : input.exercises.map((exercise, index) => ({
          exerciseTemplateId: exercise.exerciseTemplateId,
          orderIndex: exercise.orderIndex ?? index,
          notes: exercise.notes,
          supersetGroupKey: exercise.supersetGroupKey,
        }));
    assertUniqueSessionExerciseOrderIndexes(sessionExerciseCreates);

    let session;
    try {
      session = await this.prisma.workoutSession.create({
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
    } catch (error) {
      if (isSessionExerciseOrderUniqueConstraintError(error)) {
        this.throwSessionExerciseOrderConflict();
      }

      throw error;
    }

    if (!Array.isArray(session.sessionExercises)) {
      return session;
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
      this.throwSessionNotFound();
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
      this.throwSessionNotFound();
    }

    if (existing.version !== input.version) {
      this.throwSessionVersionConflict(existing.version, input.version);
    }

    const updated = await this.prisma.workoutSession.updateMany({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
        version: input.version,
      },
      data: {
        notes: input.notes,
        endedReason: input.endedReason,
        version: { increment: 1 },
      },
    });

    if (!updated.count) {
      const current = await this.prisma.workoutSession.findFirst({
        where: {
          id: sessionId,
          userId,
          deletedAt: null,
        },
        select: {
          version: true,
        },
      });

      if (!current) {
        this.throwSessionNotFound();
      }

      this.throwSessionVersionConflict(current.version, input.version);
    }

    const session = await this.prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
    });

    if (!session) {
      this.throwSessionNotFound();
    }

    return session;
  }

  async finishSession(userId: string, sessionId: string) {
    const existing = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        startedAt: true,
        status: true,
        endedReason: true,
        user: {
          select: {
            timezone: true,
          },
        },
      },
    });

    if (!existing) {
      this.throwSessionNotFound();
    }

    if (existing.status !== 'IN_PROGRESS') {
      this.throwSessionAlreadyFinished();
    }

    const finishedAt = new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((finishedAt.getTime() - existing.startedAt.getTime()) / 1000),
    );

    const totalVolume = await this.volumeService.cacheSessionVolume(sessionId);
    const newPrs = await this.prDetectionService.detectForSession(
      userId,
      sessionId,
    );
    await this.streakService.onSessionFinished(
      userId,
      finishedAt,
      existing.user?.timezone ?? 'UTC',
    );
    const completion = await this.completionService.calculate(sessionId);
    const updated = await this.prisma.workoutSession.updateMany({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'FINISHED',
        finishedAt,
        endedReason: existing.endedReason ?? 'USER_ENDED',
        durationSeconds,
        version: { increment: 1 },
      },
    });

    if (!updated.count) {
      const current = await this.prisma.workoutSession.findFirst({
        where: {
          id: sessionId,
          userId,
          deletedAt: null,
        },
        select: {
          status: true,
        },
      });

      if (!current) {
        this.throwSessionNotFound();
      }

      if (current.status !== 'IN_PROGRESS') {
        this.throwSessionAlreadyFinished();
      }
    }

    const session = await this.prisma.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
    });

    if (!session) {
      this.throwSessionNotFound();
    }

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
    const normalizedItems = items.map((item) => ({
      ...item,
      workoutTemplate:
        item.workoutTemplate?.deletedAt != null ? null : item.workoutTemplate,
    }));

    return {
      items: normalizedItems,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
  }

  async getActiveSession(userId: string) {
    const session = await this.prisma.workoutSession.findFirst({
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

    if (!session) {
      return null;
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
      this.throwSessionNotFound();
    }

    const sessionExercises = await this.prisma.sessionExercise.findMany({
      where: {
        sessionId,
        deletedAt: null,
      },
      select: {
        exerciseTemplateId: true,
      },
    });
    const exerciseTemplateIds = Array.from(
      new Set(sessionExercises.map((row) => row.exerciseTemplateId)),
    );
    await Promise.all(
      exerciseTemplateIds.map((exerciseTemplateId) =>
        this.prDetectionService.recalculateForExercise(
          userId,
          exerciseTemplateId,
        ),
      ),
    );

    return { success: true };
  }

  async addSessionExercise(
    userId: string,
    sessionId: string,
    input: AddSessionExerciseDto,
  ) {
    await this.assertSessionOwnership(userId, sessionId);
    await this.assertExerciseTemplateAccessible(
      userId,
      input.exerciseTemplateId,
    );

    try {
      return await this.prisma.sessionExercise.create({
        data: {
          sessionId,
          exerciseTemplateId: input.exerciseTemplateId,
          orderIndex: input.orderIndex,
          notes: input.notes,
          supersetGroupKey: input.supersetGroupKey,
        },
      });
    } catch (error) {
      if (isSessionExerciseOrderUniqueConstraintError(error)) {
        this.throwSessionExerciseOrderConflict();
      }

      throw error;
    }
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
        session: {
          userId,
          deletedAt: null,
        },
      },
    });

    if (!target) {
      this.throwSessionExerciseNotFound();
    }

    if (input.version && target.version !== input.version) {
      this.throwSessionExerciseVersionConflict();
    }

    let updated;
    try {
      updated = await this.prisma.sessionExercise.updateMany({
        where: {
          id: target.id,
          sessionId,
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
          version: input.version,
        },
        data: {
          notes: input.notes,
          supersetGroupKey: input.supersetGroupKey,
          orderIndex: input.orderIndex,
          version: { increment: 1 },
        },
      });
    } catch (error) {
      if (isSessionExerciseOrderUniqueConstraintError(error)) {
        this.throwSessionExerciseOrderConflict();
      }

      throw error;
    }

    if (!updated.count) {
      const current = await this.prisma.sessionExercise.findFirst({
        where: {
          id: sessionExerciseId,
          sessionId,
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
        },
        select: {
          version: true,
        },
      });

      if (!current) {
        this.throwSessionExerciseNotFound();
      }

      this.throwSessionExerciseVersionConflict();
    }

    const sessionExercise = await this.prisma.sessionExercise.findFirst({
      where: {
        id: target.id,
        sessionId,
        deletedAt: null,
        session: {
          userId,
          deletedAt: null,
        },
      },
    });

    if (!sessionExercise) {
      this.throwSessionExerciseNotFound();
    }

    return sessionExercise;
  }

  async deleteSessionExercise(
    userId: string,
    sessionId: string,
    sessionExerciseId: string,
  ) {
    const target = await this.prisma.sessionExercise.findFirst({
      where: {
        id: sessionExerciseId,
        sessionId,
        deletedAt: null,
        session: {
          userId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        exerciseTemplateId: true,
        session: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!target) {
      this.throwSessionExerciseNotFound();
    }

    const updated = await this.prisma.sessionExercise.updateMany({
      where: {
        id: sessionExerciseId,
        sessionId,
        session: {
          userId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (!updated.count) {
      this.throwSessionExerciseNotFound();
    }

    await this.prDetectionService.recalculateForExercise(
      userId,
      target.exerciseTemplateId,
    );
    if (target.session.status === 'FINISHED') {
      await this.volumeService.cacheSessionVolume(target.session.id);
    }

    return { success: true };
  }

  async reorderSessionExercises(
    userId: string,
    sessionId: string,
    input: ReorderSessionExercisesDto,
  ) {
    await this.assertSessionOwnership(userId, sessionId);
    const exerciseIds = input.items.map((item) => item.id);
    const existingCount = await this.prisma.sessionExercise.count({
      where: {
        id: {
          in: exerciseIds,
        },
        sessionId,
        deletedAt: null,
      },
    });
    if (existingCount !== exerciseIds.length) {
      this.throwSessionExerciseNotFound();
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const temporaryResults = await Promise.all(
          input.items.map((item, index) =>
            tx.sessionExercise.updateMany({
              where: {
                id: item.id,
                sessionId,
                deletedAt: null,
                session: {
                  userId,
                  deletedAt: null,
                },
              },
              data: {
                orderIndex: -(index + 1),
              },
            }),
          ),
        );

        if (temporaryResults.some((result) => result.count === 0)) {
          this.throwSessionExerciseNotFound();
        }

        const finalResults = await Promise.all(
          input.items.map((item) =>
            tx.sessionExercise.updateMany({
              where: {
                id: item.id,
                sessionId,
                deletedAt: null,
                session: {
                  userId,
                  deletedAt: null,
                },
              },
              data: {
                orderIndex: item.orderIndex,
              },
            }),
          ),
        );

        if (finalResults.some((result) => result.count === 0)) {
          this.throwSessionExerciseNotFound();
        }
      });
    } catch (error) {
      if (isSessionExerciseOrderUniqueConstraintError(error)) {
        this.throwSessionExerciseOrderConflict();
      }

      throw error;
    }

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
        session: {
          userId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        exerciseTemplateId: true,
      },
    });

    if (!exercise) {
      this.throwSessionExerciseNotFound();
    }

    await this.assertExerciseTemplateAccessible(
      userId,
      input.toExerciseTemplateId,
    );

    const updated = await this.prisma.sessionExercise.updateMany({
      where: {
        id: exercise.id,
        sessionId,
        deletedAt: null,
        session: {
          userId,
          deletedAt: null,
        },
      },
      data: {
        exerciseTemplateId: input.toExerciseTemplateId,
        version: { increment: 1 },
      },
    });

    if (!updated.count) {
      this.throwSessionExerciseNotFound();
    }

    const affectedExerciseTemplateIds = Array.from(
      new Set([exercise.exerciseTemplateId, input.toExerciseTemplateId]),
    );
    await Promise.all(
      affectedExerciseTemplateIds.map((exerciseTemplateId) =>
        this.prDetectionService.recalculateForExercise(
          userId,
          exerciseTemplateId,
        ),
      ),
    );

    return {
      ...exercise,
      exerciseTemplateId: input.toExerciseTemplateId,
    };
  }

  async createSet(
    userId: string,
    sessionExerciseId: string,
    input: CreateSetDto,
  ) {
    const createdSet = await this.createSetInternal(
      userId,
      sessionExerciseId,
      input,
    );
    if (createdSet.wasCreated && createdSet.item.isCompleted) {
      await this.prDetectionService.recalculateForExercise(
        userId,
        createdSet.exerciseTemplateId,
      );
    }
    if (createdSet.sessionStatus === 'FINISHED') {
      await this.volumeService.cacheSessionVolume(createdSet.sessionId);
    }

    return createdSet.item;
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
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
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
      this.throwSetNotFound();
    }

    const updateData: SetWriteData = {
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
      if (!input.isCompleted) {
        updateData.completedAt = null;
      } else if (input.completedAt) {
        updateData.completedAt = new Date(input.completedAt);
      } else {
        updateData.completedAt = existing.completedAt ?? new Date();
      }
    } else if (input.completedAt !== undefined) {
      updateData.isCompleted = true;
      updateData.completedAt = new Date(input.completedAt);
    }

    let updated;
    try {
      updated = await this.prisma.set.updateMany({
        where: {
          id: setId,
          sessionExerciseId,
          deletedAt: null,
          sessionExercise: {
            deletedAt: null,
            session: {
              userId,
              deletedAt: null,
            },
          },
        },
        data: updateData,
      });
    } catch (error) {
      if (isSetOrderUniqueConstraintError(error)) {
        this.throwSetOrderConflict();
      }

      throw error;
    }

    if (!updated.count) {
      this.throwSetNotFound();
    }

    if (isPrAffectingSetUpdate(input)) {
      await this.prDetectionService.recalculateForExercise(
        userId,
        existing.sessionExercise.exerciseTemplateId,
      );
    }

    if (existing.sessionExercise.session.status === 'FINISHED') {
      await this.volumeService.cacheSessionVolume(
        existing.sessionExercise.session.id,
      );
    }

    return mergeSetWithUpdateData(existing, updateData);
  }

  async deleteSet(userId: string, sessionExerciseId: string, setId: string) {
    const existing = await this.prisma.set.findFirst({
      where: {
        id: setId,
        sessionExerciseId,
        deletedAt: null,
        sessionExercise: {
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
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
      this.throwSetNotFound();
    }

    const updated = await this.prisma.set.updateMany({
      where: {
        id: existing.id,
        sessionExerciseId,
        deletedAt: null,
        sessionExercise: {
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
        },
      },
      data: { deletedAt: new Date() },
    });

    if (!updated.count) {
      this.throwSetNotFound();
    }

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
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
        },
      },
      include: {
        sessionExercise: {
          include: {
            session: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      this.throwSetNotFound();
    }

    const completedAt = input.isCompleted
      ? existing.isCompleted
        ? (existing.completedAt ?? new Date())
        : new Date()
      : null;
    const updated = await this.prisma.set.updateMany({
      where: {
        id: setId,
        sessionExerciseId,
        deletedAt: null,
        sessionExercise: {
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
        },
      },
      data: {
        isCompleted: input.isCompleted,
        completedAt,
      },
    });

    if (!updated.count) {
      this.throwSetNotFound();
    }

    await this.prDetectionService.recalculateForExercise(
      userId,
      existing.sessionExercise.exerciseTemplateId,
    );
    if (existing.sessionExercise.session.status === 'FINISHED') {
      await this.volumeService.cacheSessionVolume(
        existing.sessionExercise.session.id,
      );
    }

    return {
      ...existing,
      isCompleted: input.isCompleted,
      completedAt,
    };
  }

  async batchCreateSets(
    userId: string,
    sessionExerciseId: string,
    input: BatchCreateSetsDto,
  ) {
    const sessionExercise = await this.assertSessionExerciseOwnership(
      userId,
      sessionExerciseId,
    );

    const createdSets = await Promise.all(
      input.sets.map((set) =>
        this.createSetInternal(userId, sessionExerciseId, set, sessionExercise),
      ),
    );
    const results = createdSets.map((createdSet) => createdSet.item);
    const shouldRecalculatePrs = createdSets.some(
      (createdSet) => createdSet.wasCreated && createdSet.item.isCompleted,
    );

    if (shouldRecalculatePrs) {
      await this.prDetectionService.recalculateForExercise(
        userId,
        sessionExercise.exerciseTemplateId,
      );
    }
    if (sessionExercise.session.status === 'FINISHED') {
      await this.volumeService.cacheSessionVolume(sessionExercise.session.id);
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
      this.throwSessionForbidden();
    }
  }

  private async assertWorkoutTemplateOwnership(
    userId: string,
    workoutTemplateId: string,
  ) {
    const template = await this.prisma.workoutTemplate.findFirst({
      where: {
        id: workoutTemplateId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!template) {
      this.throwTemplateForbidden();
    }
  }

  private async assertExerciseTemplatesAccessible(
    userId: string,
    exerciseTemplateIds: string[],
  ) {
    const uniqueIds = Array.from(new Set(exerciseTemplateIds));

    const accessibleExercises = await this.prisma.exerciseTemplate.findMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
        OR: [{ isGlobal: true }, { ownerUserId: userId }],
      },
      select: { id: true },
    });

    if (accessibleExercises.length !== uniqueIds.length) {
      this.throwExerciseForbidden();
    }
  }

  private async assertExerciseTemplateAccessible(
    userId: string,
    exerciseTemplateId: string,
  ) {
    await this.assertExerciseTemplatesAccessible(userId, [exerciseTemplateId]);
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
      select: {
        id: true,
        exerciseTemplateId: true,
        session: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!sessionExercise) {
      this.throwSessionExerciseForbidden();
    }

    return sessionExercise;
  }

  private async createSetInternal(
    userId: string,
    sessionExerciseId: string,
    input: CreateSetDto,
    existingSessionExercise?: {
      id: string;
      exerciseTemplateId: string;
      session: {
        id: string;
        status: 'IN_PROGRESS' | 'FINISHED';
      };
    },
  ) {
    const sessionExercise =
      existingSessionExercise ??
      (await this.prisma.sessionExercise.findFirst({
        where: {
          id: sessionExerciseId,
          deletedAt: null,
          session: {
            userId,
            deletedAt: null,
          },
        },
        select: {
          id: true,
          exerciseTemplateId: true,
          session: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }));

    if (!sessionExercise) {
      this.throwSessionExerciseNotFound();
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.set.findFirst({
        where: {
          sessionExerciseId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) {
        return {
          item: existing,
          wasCreated: false,
          exerciseTemplateId: sessionExercise.exerciseTemplateId,
          sessionId: sessionExercise.session.id,
          sessionStatus: sessionExercise.session.status,
        };
      }
    }

    let created;
    try {
      created = await this.prisma.set.create({
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
                  status: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      if (
        input.idempotencyKey &&
        isSetIdempotencyUniqueConstraintError(error)
      ) {
        const existing = await this.prisma.set.findFirst({
          where: {
            sessionExerciseId,
            idempotencyKey: input.idempotencyKey,
          },
        });

        if (existing) {
          return {
            item: existing,
            wasCreated: false,
            exerciseTemplateId: sessionExercise.exerciseTemplateId,
            sessionId: sessionExercise.session.id,
            sessionStatus: sessionExercise.session.status,
          };
        }
      }

      if (isSetOrderUniqueConstraintError(error)) {
        this.throwSetOrderConflict();
      }

      throw error;
    }

    return {
      item: created,
      wasCreated: true,
      exerciseTemplateId: sessionExercise.exerciseTemplateId,
      sessionId: created.sessionExercise.session.id,
      sessionStatus: created.sessionExercise.session.status,
    };
  }

  private throwSessionNotFound(): never {
    throw new NotFoundException({
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
  }

  private throwSessionExerciseNotFound(): never {
    throw new NotFoundException({
      code: 'SESSION_EXERCISE_NOT_FOUND',
      message: 'Session exercise not found',
    });
  }

  private throwSetNotFound(): never {
    throw new NotFoundException({
      code: 'SET_NOT_FOUND',
      message: 'Set not found',
    });
  }

  private throwSessionVersionConflict(
    expectedVersion: number,
    incomingVersion: number,
  ): never {
    throw new ConflictException({
      code: 'SESSION_VERSION_CONFLICT',
      message: 'Session was updated elsewhere. Refresh and try again.',
      details: {
        expectedVersion,
        incomingVersion,
      },
    });
  }

  private throwSessionExerciseVersionConflict(): never {
    throw new ConflictException({
      code: 'SESSION_EXERCISE_VERSION_CONFLICT',
      message: 'Session exercise changed elsewhere',
    });
  }

  private throwSessionExerciseOrderConflict(): never {
    throw new ConflictException({
      code: 'SESSION_EXERCISE_ORDER_CONFLICT',
      message: 'Another session exercise already uses that orderIndex',
    });
  }

  private throwSetOrderConflict(): never {
    throw new ConflictException({
      code: 'SET_ORDER_CONFLICT',
      message: 'Another set already uses that orderIndex',
    });
  }

  private throwSessionAlreadyFinished(): never {
    throw new ConflictException({
      code: 'SESSION_ALREADY_FINISHED',
      message: 'Session is already finished',
    });
  }

  private throwSessionForbidden(): never {
    throw new ForbiddenException({
      code: 'SESSION_FORBIDDEN',
      message: 'Session not found or inaccessible',
    });
  }

  private throwSessionExerciseForbidden(): never {
    throw new ForbiddenException({
      code: 'SESSION_EXERCISE_FORBIDDEN',
      message: 'Session exercise not found or inaccessible',
    });
  }

  private throwTemplateForbidden(): never {
    throw new ForbiddenException({
      code: 'TEMPLATE_FORBIDDEN',
      message: 'Template not found or inaccessible',
    });
  }

  private throwExerciseForbidden(): never {
    throw new ForbiddenException({
      code: 'EXERCISE_FORBIDDEN',
      message: 'Exercise not found or inaccessible',
    });
  }
}

function isPrAffectingSetUpdate(input: UpdateSetDto): boolean {
  return (
    input.weight !== undefined ||
    input.reps !== undefined ||
    input.durationSeconds !== undefined ||
    input.isCompleted !== undefined ||
    input.completedAt !== undefined
  );
}

function assertUniqueSessionExerciseOrderIndexes(
  items: Array<{ orderIndex: number }>,
) {
  const seenOrderIndexes = new Set<number>();
  for (const item of items) {
    if (seenOrderIndexes.has(item.orderIndex)) {
      throw new BadRequestException({
        code: 'DUPLICATE_SESSION_EXERCISE_ORDER_INDEX',
        message: 'Duplicate orderIndex in session exercises payload',
      });
    }

    seenOrderIndexes.add(item.orderIndex);
  }
}

type SetReturnMergeData = {
  orderIndex?: number | null;
  type?: UpdateSetDto['type'];
  payload?: unknown;
  idempotencyKey?: string | null;
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  isCompleted?: boolean;
  completedAt?: Date | null;
};

type SetWriteData = {
  orderIndex?: number;
  type?: UpdateSetDto['type'];
  payload?: Prisma.InputJsonValue;
  idempotencyKey?: string;
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  rpe?: number | null;
  isCompleted?: boolean;
  completedAt?: Date | null;
};

function mergeSetWithUpdateData<T extends Record<string, unknown>>(
  existing: T,
  updateData: SetReturnMergeData,
): T {
  return {
    ...existing,
    orderIndex: pickUpdatedValue(existing.orderIndex, updateData.orderIndex),
    type: pickUpdatedValue(existing.type, updateData.type),
    payload: pickUpdatedValue(existing.payload, updateData.payload),
    idempotencyKey: pickUpdatedValue(
      existing.idempotencyKey,
      updateData.idempotencyKey,
    ),
    weight: pickUpdatedValue(existing.weight, updateData.weight),
    reps: pickUpdatedValue(existing.reps, updateData.reps),
    durationSeconds: pickUpdatedValue(
      existing.durationSeconds,
      updateData.durationSeconds,
    ),
    rpe: pickUpdatedValue(existing.rpe, updateData.rpe),
    isCompleted: pickUpdatedValue(existing.isCompleted, updateData.isCompleted),
    completedAt: pickUpdatedValue(existing.completedAt, updateData.completedAt),
  } as T;
}

function pickUpdatedValue<T>(existingValue: T, updatedValue: T | undefined): T {
  return updatedValue === undefined ? existingValue : updatedValue;
}

function isSetIdempotencyUniqueConstraintError(error: unknown): boolean {
  return isUniqueConstraintErrorForFields(error, [
    'sessionexerciseid',
    'idempotencykey',
  ]);
}

function isSessionExerciseOrderUniqueConstraintError(error: unknown): boolean {
  return isUniqueConstraintErrorForFields(error, ['sessionid', 'orderindex']);
}

function isSetOrderUniqueConstraintError(error: unknown): boolean {
  return isUniqueConstraintErrorForFields(error, [
    'sessionexerciseid',
    'orderindex',
  ]);
}

function isUniqueConstraintErrorForFields(
  error: unknown,
  expectedFields: string[],
): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    meta?: {
      target?: unknown;
    };
  };

  if (maybeError.code !== 'P2002') {
    return false;
  }

  const target = maybeError.meta?.target;
  if (Array.isArray(target)) {
    const lowered = target
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.toLowerCase());
    return expectedFields.every((field) => lowered.includes(field));
  }

  if (typeof target === 'string') {
    const normalized = target.toLowerCase();
    return expectedFields.every((field) => normalized.includes(field));
  }

  return false;
}
