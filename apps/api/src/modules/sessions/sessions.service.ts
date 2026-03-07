import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { CompletionService } from '../../services/completion.service';
import { PrDetectionService } from '../../services/pr-detection.service';
import { StreakService } from '../../services/streak.service';
import { SupersetService } from '../../services/superset.service';
import { VolumeService } from '../../services/volume.service';
import {
  AddSessionExerciseDto,
  ApplySessionSupersetDto,
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

type SetMutationClient = Pick<PrismaService, 'sessionExercise' | 'set'>;
const MAX_SESSION_EXERCISE_SET_READ = 200;
const MAX_SET_DURATION_SECONDS = 86_400;

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
    if (input.workoutTemplateId && input.exercises.length > 0) {
      throw new BadRequestException({
        code: 'SESSION_START_SOURCE_CONFLICT',
        message:
          'Provide either workoutTemplateId or inline exercises, but not both',
      });
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const activeSession = await tx.workoutSession.findFirst({
        where: {
          userId,
          status: 'IN_PROGRESS',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (activeSession) {
        this.throwActiveSessionConflict();
      }

      if (input.workoutTemplateId) {
        await this.assertWorkoutTemplateOwnership(
          userId,
          input.workoutTemplateId,
          tx,
        );
      } else if (input.exercises.length > 0) {
        await this.assertExerciseTemplatesAccessible(
          userId,
          input.exercises.map((exercise) => exercise.exerciseTemplateId),
          tx,
        );
      }

      const templateExercises = input.workoutTemplateId
        ? await tx.workoutTemplateExercise.findMany({
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

      try {
        return await tx.workoutSession.create({
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
    });

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
              take: MAX_SESSION_EXERCISE_SET_READ,
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

    if (input.endedReason !== undefined && existing.status === 'IN_PROGRESS') {
      throw new BadRequestException({
        code: 'SESSION_ENDED_REASON_NOT_ALLOWED',
        message:
          'endedReason cannot be updated while the session is in progress',
      });
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

    let totalVolume: number;
    let newPrs: Awaited<ReturnType<PrDetectionService['detectForSession']>> =
      [];
    let completion: Awaited<ReturnType<CompletionService['calculate']>>;
    try {
      totalVolume = await this.volumeService.cacheSessionVolume(sessionId);
      newPrs = await this.prDetectionService.detectForSession(
        userId,
        sessionId,
      );
      await this.streakService.onSessionFinished(
        userId,
        finishedAt,
        existing.user?.timezone ?? 'UTC',
      );
      completion = await this.completionService.calculate(sessionId, userId);
    } catch (error) {
      await this.prisma.workoutSession.updateMany({
        where: {
          id: sessionId,
          userId,
          deletedAt: null,
          status: 'FINISHED',
        },
        data: {
          status: 'IN_PROGRESS',
          finishedAt: null,
          endedReason: existing.endedReason,
          totalVolume: null,
          durationSeconds: null,
          version: { increment: 1 },
        },
      });

      if (newPrs.length > 0) {
        const exerciseTemplateIds = Array.from(
          new Set(newPrs.map((record) => record.exerciseTemplateId)),
        );
        await Promise.all(
          exerciseTemplateIds.map((exerciseTemplateId) =>
            this.prDetectionService.recalculateForExercise(
              userId,
              exerciseTemplateId,
            ),
          ),
        );
      }
      throw error;
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
      status: query.status,
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

  async applySessionSuperset(
    userId: string,
    sessionId: string,
    input: ApplySessionSupersetDto,
  ) {
    const selectedExerciseIds = input.exerciseIds;

    await this.prisma.$transaction(async (tx) => {
      const session = await tx.workoutSession.findFirst({
        where: {
          id: sessionId,
          userId,
          deletedAt: null,
          status: 'IN_PROGRESS',
        },
        select: {
          id: true,
          sessionExercises: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      });

      if (!session) {
        this.throwSessionNotFound();
      }

      const availableExerciseIds = new Set(
        session.sessionExercises.map((exercise) => exercise.id),
      );
      if (
        selectedExerciseIds.some(
          (exerciseId) => !availableExerciseIds.has(exerciseId),
        )
      ) {
        this.throwInvalidSupersetSelection();
      }

      await tx.sessionExercise.updateMany({
        where: {
          sessionId,
          deletedAt: null,
        },
        data: {
          supersetGroupKey: null,
        },
      });
      await tx.sessionExercise.updateMany({
        where: {
          sessionId,
          deletedAt: null,
          id: {
            in: selectedExerciseIds,
          },
        },
        data: {
          supersetGroupKey: randomUUID(),
        },
      });
    });

    return this.getSession(userId, sessionId);
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
              take: MAX_SESSION_EXERCISE_SET_READ,
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
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workoutSession.updateMany({
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

      const sessionExercises = await tx.sessionExercise.findMany({
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

      for (const exerciseTemplateId of exerciseTemplateIds) {
        await this.prDetectionService.recalculateForExercise(
          userId,
          exerciseTemplateId,
          tx,
        );
      }
    });

    return { success: true };
  }

  async addSessionExercise(
    userId: string,
    sessionId: string,
    input: AddSessionExerciseDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertSessionOwnership(
          userId,
          sessionId,
          {
            requireInProgress: true,
          },
          tx,
        );
        await this.assertExerciseTemplatesAccessible(
          userId,
          [input.exerciseTemplateId],
          tx,
        );

        return tx.sessionExercise.create({
          data: {
            sessionId,
            exerciseTemplateId: input.exerciseTemplateId,
            orderIndex: input.orderIndex,
            notes: input.notes,
            supersetGroupKey: input.supersetGroupKey,
          },
        });
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
      select: {
        id: true,
        version: true,
        session: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!target) {
      this.throwSessionExerciseNotFound();
    }

    if (target.session?.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
    }

    if (input.version !== undefined && target.version !== input.version) {
      this.throwSessionExerciseVersionConflict();
    }

    const expectedVersion = input.version ?? target.version;

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
            status: 'IN_PROGRESS',
          },
          version: expectedVersion,
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
          session: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!current) {
        this.throwSessionExerciseNotFound();
      }

      if (current.session?.status === 'FINISHED') {
        this.throwSessionAlreadyFinished();
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

    if (target.session.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
    }

    const updated = await this.prisma.sessionExercise.updateMany({
      where: {
        id: sessionExerciseId,
        sessionId,
        session: {
          userId,
          deletedAt: null,
          status: 'IN_PROGRESS',
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

    return { success: true };
  }

  async reorderSessionExercises(
    userId: string,
    sessionId: string,
    input: ReorderSessionExercisesDto,
  ) {
    await this.assertSessionOwnership(userId, sessionId, {
      requireInProgress: true,
    });
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
                  status: 'IN_PROGRESS',
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
                  status: 'IN_PROGRESS',
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
        session: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!exercise) {
      this.throwSessionExerciseNotFound();
    }

    if (exercise.session?.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
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
          status: 'IN_PROGRESS',
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

    const refreshed = await this.prisma.sessionExercise.findFirst({
      where: {
        id: exercise.id,
        sessionId,
        deletedAt: null,
        session: {
          userId,
          deletedAt: null,
        },
      },
    });

    if (!refreshed) {
      this.throwSessionExerciseNotFound();
    }

    return refreshed;
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

    if (existing.sessionExercise.session.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
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
    assertDurationSecondsWithinLimit(input.durationSeconds);

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
              status: 'IN_PROGRESS',
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

    const refreshed = await this.prisma.set.findFirst({
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

    if (!refreshed) {
      this.throwSetNotFound();
    }

    return refreshed;
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

    if (existing.sessionExercise.session.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
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
            status: 'IN_PROGRESS',
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

    if (existing.sessionExercise.session.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
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
            status: 'IN_PROGRESS',
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
    const refreshed = await this.prisma.set.findFirst({
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

    if (!refreshed) {
      this.throwSetNotFound();
    }

    return refreshed;
  }

  async batchCreateSets(
    userId: string,
    sessionExerciseId: string,
    input: BatchCreateSetsDto,
  ) {
    assertUniqueBatchSetIdempotencyKeys(input.sets);
    const { sessionExercise, createdSets } = await this.prisma.$transaction(
      async (tx) => {
        const ownedSessionExercise = await this.assertSessionExerciseOwnership(
          userId,
          sessionExerciseId,
          tx,
          { requireInProgress: true },
        );

        const created = await Promise.all(
          input.sets.map((set) =>
            this.createSetInternal(
              userId,
              sessionExerciseId,
              set,
              ownedSessionExercise,
              tx,
            ),
          ),
        );

        return {
          sessionExercise: ownedSessionExercise,
          createdSets: created,
        };
      },
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
    return {
      items: results,
      count: results.length,
    };
  }

  private async assertSessionOwnership(
    userId: string,
    sessionId: string,
    options?: { requireInProgress?: boolean },
    client: Pick<PrismaService, 'workoutSession'> = this.prisma,
  ) {
    const session = await client.workoutSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!session) {
      this.throwSessionForbidden();
    }

    if (options?.requireInProgress && session.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
    }

    return session;
  }

  private async assertWorkoutTemplateOwnership(
    userId: string,
    workoutTemplateId: string,
    client: Pick<PrismaService, 'workoutTemplate'> = this.prisma,
  ) {
    const template = await client.workoutTemplate.findFirst({
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
    client: Pick<PrismaService, 'exerciseTemplate'> = this.prisma,
  ) {
    const uniqueIds = Array.from(new Set(exerciseTemplateIds));

    const accessibleExercises = await client.exerciseTemplate.findMany({
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
    client: SetMutationClient = this.prisma,
    options?: { requireInProgress?: boolean },
  ) {
    const sessionExercise = await client.sessionExercise.findFirst({
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

    if (
      options?.requireInProgress &&
      sessionExercise.session.status === 'FINISHED'
    ) {
      this.throwSessionAlreadyFinished();
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
    client: SetMutationClient = this.prisma,
  ) {
    const sessionExercise =
      existingSessionExercise ??
      (await client.sessionExercise.findFirst({
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

    assertDurationSecondsWithinLimit(input.durationSeconds);

    if (input.idempotencyKey) {
      const existing = await client.set.findFirst({
        where: {
          sessionExerciseId,
          idempotencyKey: input.idempotencyKey,
          deletedAt: null,
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

    if (sessionExercise.session?.status === 'FINISHED') {
      this.throwSessionAlreadyFinished();
    }

    let created;
    try {
      created = await client.set.create({
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
        const existing = await client.set.findFirst({
          where: {
            sessionExerciseId,
            idempotencyKey: input.idempotencyKey,
            deletedAt: null,
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

        const deletedConflict = await client.set.findFirst({
          where: {
            sessionExerciseId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        if (deletedConflict?.deletedAt) {
          throw new ConflictException({
            code: 'SET_IDEMPOTENCY_KEY_REUSED',
            message: 'Idempotency key was previously used by a deleted set',
          });
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

  private throwActiveSessionConflict(): never {
    throw new ConflictException({
      code: 'ACTIVE_SESSION_EXISTS',
      message:
        'Finish or delete the current active session before starting a new one',
    });
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

  private throwInvalidSupersetSelection(): never {
    throw new BadRequestException({
      code: 'INVALID_SUPERSET_SELECTION',
      message: 'Selected exercises must belong to the active session',
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

function assertDurationSecondsWithinLimit(durationSeconds?: number | null) {
  if (
    durationSeconds !== undefined &&
    durationSeconds !== null &&
    durationSeconds > MAX_SET_DURATION_SECONDS
  ) {
    throw new BadRequestException({
      code: 'SET_DURATION_TOO_LARGE',
      message: `durationSeconds must not exceed ${MAX_SET_DURATION_SECONDS}`,
    });
  }
}

function assertUniqueBatchSetIdempotencyKeys(sets: BatchCreateSetsDto['sets']) {
  const seenKeys = new Set<string>();

  for (const set of sets) {
    if (!set.idempotencyKey) {
      continue;
    }

    if (seenKeys.has(set.idempotencyKey)) {
      throw new BadRequestException({
        code: 'DUPLICATE_SET_IDEMPOTENCY_KEY',
        message: 'Duplicate idempotencyKey in batch payload',
      });
    }

    seenKeys.add(set.idempotencyKey);
  }
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
