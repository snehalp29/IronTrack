import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import type { CompletionService } from '../../services/completion.service';
import type { PrDetectionService } from '../../services/pr-detection.service';
import type { StreakService } from '../../services/streak.service';
import type { SupersetService } from '../../services/superset.service';
import type { VolumeService } from '../../services/volume.service';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  const createService = () => {
    const prismaMock = {
      workoutTemplateExercise: {
        findMany: jest.fn(),
      },
      workoutSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      sessionExercise: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      set: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg as Promise<unknown>[]);
        }
        throw new Error('Unsupported transaction shape in test');
      }),
    } as unknown as PrismaService;

    const prDetectionMock = {
      detectForSession: jest.fn(),
      recalculateForExercise: jest.fn(async () => undefined),
    } as unknown as PrDetectionService;

    const volumeMock = {
      cacheSessionVolume: jest.fn(),
    } as unknown as VolumeService;

    const streakMock = {
      onSessionFinished: jest.fn(async () => undefined),
    } as unknown as StreakService;

    const completionMock = {
      calculate: jest.fn(),
    } as unknown as CompletionService;

    const supersetMock = {
      interleave: jest.fn((items) => items),
    } as unknown as SupersetService;

    return {
      service: new SessionsService(
        prismaMock,
        prDetectionMock,
        volumeMock,
        streakMock,
        completionMock,
        supersetMock,
      ),
      prismaMock,
      prDetectionMock,
      volumeMock,
      streakMock,
      completionMock,
      supersetMock,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts a session from workout template exercises', async () => {
    const { service, prismaMock } = createService();
    (
      prismaMock.workoutTemplateExercise.findMany as jest.Mock
    ).mockResolvedValue([
      {
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 2,
        supersetGroupKey: 'A',
      },
    ]);
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });

    await expect(
      service.startSession('user-1', {
        workoutTemplateId: 'template-1',
        notes: 'from template',
        exercises: [],
      }),
    ).resolves.toEqual({ id: 'session-1' });

    expect(prismaMock.workoutSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionExercises: {
            create: [
              {
                exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
                orderIndex: 2,
                notes: null,
                supersetGroupKey: 'A',
              },
            ],
          },
        }),
      }),
    );
  });

  it('uses template exercise index when orderIndex is missing', async () => {
    const { service, prismaMock } = createService();
    (
      prismaMock.workoutTemplateExercise.findMany as jest.Mock
    ).mockResolvedValue([
      {
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: undefined,
        supersetGroupKey: null,
      },
    ]);
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });

    await service.startSession('user-1', {
      workoutTemplateId: 'template-1',
      notes: 'from template',
      exercises: [],
    });

    expect(prismaMock.workoutSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionExercises: {
            create: [
              expect.objectContaining({
                orderIndex: 0,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('starts a session from inline exercises when no template is provided', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });

    await service.startSession('user-1', {
      notes: 'inline',
      exercises: [
        {
          exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
          orderIndex: 0,
          notes: 'first',
        },
      ],
    });

    expect(prismaMock.workoutTemplateExercise.findMany).not.toHaveBeenCalled();
    expect(prismaMock.workoutSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionExercises: {
            create: [
              {
                exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
                orderIndex: 0,
                notes: 'first',
                supersetGroupKey: undefined,
              },
            ],
          },
        }),
      }),
    );
  });

  it('uses inline exercise index when orderIndex is omitted', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });

    await service.startSession('user-1', {
      notes: 'inline-index',
      exercises: [
        {
          exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
          notes: 'first',
        },
      ],
    });

    expect(prismaMock.workoutSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionExercises: {
            create: [
              expect.objectContaining({
                orderIndex: 0,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('starts an empty inline session when exercises are omitted', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });

    await service.startSession('user-1', {
      notes: 'no exercises',
      exercises: [],
    });

    expect(prismaMock.workoutSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionExercises: {
            create: [],
          },
        }),
      }),
    );
  });

  it('gets a session and interleaves exercises', async () => {
    const { service, prismaMock, supersetMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      sessionExercises: [
        { id: 'se1', orderIndex: 0, supersetGroupKey: null },
        { id: 'se2', orderIndex: 1, supersetGroupKey: 'A' },
      ],
    });
    (supersetMock.interleave as jest.Mock).mockReturnValue([
      { id: 'se2' },
      { id: 'se1' },
    ]);

    await expect(service.getSession('user-1', 'session-1')).resolves.toEqual(
      expect.objectContaining({
        sessionExercises: [{ id: 'se2' }, { id: 'se1' }],
      }),
    );
  });

  it('throws when session is missing', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.getSession('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a session with optimistic versioning', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      version: 2,
    });
    (prismaMock.workoutSession.update as jest.Mock).mockResolvedValue({
      id: 'session-1',
      version: 3,
    });

    await expect(
      service.updateSession('user-1', 'session-1', {
        version: 2,
        notes: 'updated',
      }),
    ).resolves.toEqual({ id: 'session-1', version: 3 });
  });

  it('throws conflict when incoming session version is stale', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      version: 4,
    });

    await expect(
      service.updateSession('user-1', 'session-1', {
        version: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when updating a missing session', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateSession('user-1', 'missing', { version: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('finishes a session and returns warning when workout is incomplete', async () => {
    const {
      service,
      prismaMock,
      volumeMock,
      prDetectionMock,
      completionMock,
      streakMock,
    } = createService();

    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      startedAt: new Date(Date.now() - 2000),
      endedReason: null,
    });
    (prismaMock.workoutSession.update as jest.Mock).mockResolvedValue({
      id: 'session-1',
      status: 'FINISHED',
    });
    (volumeMock.cacheSessionVolume as jest.Mock).mockResolvedValue(1200);
    (prDetectionMock.detectForSession as jest.Mock).mockResolvedValue([
      { id: 'pr1' },
    ]);
    (completionMock.calculate as jest.Mock).mockResolvedValue({
      totalSets: 3,
      completedSets: 2,
      isIncomplete: true,
    });

    const result = await service.finishSession('user-1', 'session-1');

    expect(result.totalVolume).toBe(1200);
    expect(result.newPrs).toEqual([{ id: 'pr1' }]);
    expect(result.warning).toBe('Workout has incomplete sets');
    expect(streakMock.onSessionFinished).toHaveBeenCalledWith('user-1');
  });

  it('finishes a session without warning when workout is fully complete', async () => {
    const { service, prismaMock, volumeMock, prDetectionMock, completionMock } =
      createService();

    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      startedAt: new Date(Date.now() - 2000),
      endedReason: 'USER_ENDED',
    });
    (prismaMock.workoutSession.update as jest.Mock).mockResolvedValue({
      id: 'session-1',
      status: 'FINISHED',
    });
    (volumeMock.cacheSessionVolume as jest.Mock).mockResolvedValue(900);
    (prDetectionMock.detectForSession as jest.Mock).mockResolvedValue([]);
    (completionMock.calculate as jest.Mock).mockResolvedValue({
      totalSets: 3,
      completedSets: 3,
      isIncomplete: false,
    });

    const result = await service.finishSession('user-1', 'session-1');

    expect(result.warning).toBeNull();
  });

  it('throws when finishing a missing session', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.finishSession('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists sessions with pagination and optional date filters', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findMany as jest.Mock).mockResolvedValue([
      { id: 's1' },
    ]);
    (prismaMock.workoutSession.count as jest.Mock).mockResolvedValue(1);

    await expect(
      service.listSessions('user-1', {
        page: 2,
        pageSize: 5,
        templateId: 'template-1',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z',
      }),
    ).resolves.toEqual({
      items: [{ id: 's1' }],
      pagination: { page: 2, pageSize: 5, total: 1 },
    });

    expect(prismaMock.workoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: expect.objectContaining({
          userId: 'user-1',
          workoutTemplateId: 'template-1',
          startedAt: {
            gte: new Date('2024-01-01T00:00:00.000Z'),
            lte: new Date('2024-01-31T23:59:59.999Z'),
          },
        }),
      }),
    );
  });

  it('lists sessions without startedAt filter when no date bounds are provided', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.workoutSession.count as jest.Mock).mockResolvedValue(0);

    await service.listSessions('user-1', {
      page: 1,
      pageSize: 10,
      templateId: undefined,
      startDate: undefined,
      endDate: undefined,
    });

    expect(prismaMock.workoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startedAt: undefined,
        }),
      }),
    );
  });

  it('lists sessions with only a start date lower bound', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.workoutSession.count as jest.Mock).mockResolvedValue(0);

    await service.listSessions('user-1', {
      page: 1,
      pageSize: 10,
      templateId: undefined,
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: undefined,
    });

    expect(prismaMock.workoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startedAt: {
            gte: new Date('2024-01-01T00:00:00.000Z'),
            lte: undefined,
          },
        }),
      }),
    );
  });

  it('lists sessions with only an end date upper bound', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.workoutSession.count as jest.Mock).mockResolvedValue(0);

    await service.listSessions('user-1', {
      page: 1,
      pageSize: 10,
      templateId: undefined,
      startDate: undefined,
      endDate: '2024-01-31T23:59:59.999Z',
    });

    expect(prismaMock.workoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startedAt: {
            gte: undefined,
            lte: new Date('2024-01-31T23:59:59.999Z'),
          },
        }),
      }),
    );
  });

  it('preserves explicit timezone offsets when building session date bounds', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.workoutSession.count as jest.Mock).mockResolvedValue(0);

    await service.listSessions('user-1', {
      page: 1,
      pageSize: 10,
      templateId: undefined,
      startDate: '2024-01-01T00:00:00-05:00',
      endDate: '2024-01-01T23:59:59-05:00',
    });

    expect(prismaMock.workoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startedAt: {
            gte: new Date('2024-01-01T05:00:00.000Z'),
            lte: new Date('2024-01-02T04:59:59.000Z'),
          },
        }),
      }),
    );
  });

  it('returns active session', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'active-1',
    });

    await expect(service.getActiveSession('user-1')).resolves.toEqual({
      id: 'active-1',
    });
  });

  it('soft deletes session and returns success', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.softDeleteSession('user-1', 'session-1'),
    ).resolves.toEqual({
      success: true,
    });
  });

  it('throws when deleting missing session', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.softDeleteSession('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds session exercise after ownership check', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });
    (prismaMock.sessionExercise.create as jest.Mock).mockResolvedValue({
      id: 'se1',
    });

    await expect(
      service.addSessionExercise('user-1', 'session-1', {
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
      }),
    ).resolves.toEqual({ id: 'se1' });
  });

  it('throws forbidden when adding exercise to inaccessible session', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.addSessionExercise('user-1', 'session-1', {
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates session exercise with version check', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      version: 2,
    });
    (prismaMock.sessionExercise.update as jest.Mock).mockResolvedValue({
      id: 'se1',
    });

    await expect(
      service.updateSessionExercise('user-1', 'session-1', 'se1', {
        version: 2,
        orderIndex: 4,
      }),
    ).resolves.toEqual({ id: 'se1' });
  });

  it('throws conflict for stale session exercise version', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      version: 5,
    });

    await expect(
      service.updateSessionExercise('user-1', 'session-1', 'se1', {
        version: 4,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when updating missing session exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateSessionExercise('user-1', 'session-1', 'missing', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes session exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.deleteSessionExercise('user-1', 'session-1', 'se1'),
    ).resolves.toEqual({ success: true });
  });

  it('throws when deleting a missing session exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.deleteSessionExercise('user-1', 'session-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reorders session exercises in a transaction', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.reorderSessionExercises('user-1', 'session-1', {
        items: [{ id: 'se1', orderIndex: 9 }],
      }),
    ).resolves.toEqual({ success: true });

    expect(prismaMock.sessionExercise.updateMany).toHaveBeenCalledWith({
      where: { id: 'se1', sessionId: 'session-1', deletedAt: null },
      data: { orderIndex: 9 },
    });
  });

  it('swaps session exercise template', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
    });
    (prismaMock.sessionExercise.update as jest.Mock).mockResolvedValue({
      id: 'se1',
    });

    await expect(
      service.swapSessionExercise('user-1', 'session-1', {
        fromExerciseId: 'se1',
        toExerciseTemplateId: '11111111-1111-4111-8111-111111111111',
      }),
    ).resolves.toEqual({ id: 'se1' });
  });

  it('throws when swap target does not exist', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.swapSessionExercise('user-1', 'session-1', {
        fromExerciseId: 'missing',
        toExerciseTemplateId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates set and triggers PR recalculation when completed', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', userId: 'user-1' },
      },
    });

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        completedAt: '2024-01-01T00:00:00.000Z',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'set-1',
      }),
    );

    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
  });

  it('creates set with idempotency key when no prior set exists', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', userId: 'user-1' },
      },
    });

    await service.createSet('user-1', 'se1', {
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {},
      idempotencyKey: 'idem-123',
      isCompleted: false,
    });

    expect(prismaMock.set.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: 'idem-123',
          completedAt: null,
        }),
      }),
    );
    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
  });

  it('creates set with generated completedAt when isCompleted is true and completedAt is omitted', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
    });
    (prismaMock.set.create as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', userId: 'user-1' },
      },
    });

    await service.createSet('user-1', 'se1', {
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {},
      isCompleted: true,
    });

    expect(prismaMock.set.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalled();
  });

  it('returns idempotent existing set when key matches', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-set',
    });

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-123',
      }),
    ).resolves.toEqual({ id: 'existing-set' });
    expect(prismaMock.set.create).not.toHaveBeenCalled();
  });

  it('throws when creating set for missing session exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates set and refreshes volume for finished sessions', async () => {
    const { service, prismaMock, volumeMock, prDetectionMock } =
      createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'FINISHED',
        },
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({ id: 'set-1' });
    (volumeMock.cacheSessionVolume as jest.Mock).mockResolvedValue(1000);

    await expect(
      service.updateSet('user-1', 'se1', 'set-1', {
        isCompleted: true,
      }),
    ).resolves.toEqual({ id: 'set-1' });

    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
  });

  it('updates set with explicit completedAt when isCompleted=true', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({ id: 'set-1' });

    await service.updateSet('user-1', 'se1', 'set-1', {
      isCompleted: true,
      completedAt: '2024-01-03T10:00:00.000Z',
    });

    expect(prismaMock.set.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: new Date('2024-01-03T10:00:00.000Z'),
        }),
      }),
    );
  });

  it('updates set with isCompleted=false and clears completedAt', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({ id: 'set-1' });

    await service.updateSet('user-1', 'se1', 'set-1', {
      isCompleted: false,
    });

    expect(prismaMock.set.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      }),
    );
  });

  it('updates set without completion fields when neither isCompleted nor completedAt is provided', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({ id: 'set-1' });

    await service.updateSet('user-1', 'se1', 'set-1', {
      notes: 'no completion change',
    } as never);

    const updateCall = (prismaMock.set.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('isCompleted');
    expect(updateCall.data).not.toHaveProperty('completedAt');
  });

  it('updates set from completedAt only and skips volume for in-progress sessions', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({ id: 'set-1' });

    await service.updateSet('user-1', 'se1', 'set-1', {
      completedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(prismaMock.set.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: new Date('2024-01-01T00:00:00.000Z'),
        }),
      }),
    );
    expect(volumeMock.cacheSessionVolume).not.toHaveBeenCalled();
  });

  it('throws when updating missing set', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateSet('user-1', 'se1', 'set-1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes set and refreshes dependencies', async () => {
    const { service, prismaMock, volumeMock, prDetectionMock } =
      createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', status: 'FINISHED' },
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({ id: 'set-1' });

    await expect(service.deleteSet('user-1', 'se1', 'set-1')).resolves.toEqual({
      success: true,
    });
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
  });

  it('deletes set without recaching volume for in-progress sessions', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', status: 'IN_PROGRESS' },
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({ id: 'set-1' });

    await service.deleteSet('user-1', 'se1', 'set-1');

    expect(volumeMock.cacheSessionVolume).not.toHaveBeenCalled();
  });

  it('throws when deleting missing set', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.deleteSet('user-1', 'se1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('toggles set completion and recalculates PRs', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
    });

    await expect(
      service.toggleSetCompletion('user-1', 'se1', 'set-1', {
        isCompleted: false,
      }),
    ).resolves.toEqual({ id: 'set-1', isCompleted: false });

    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
  });

  it('toggles completion to true and stores a completion timestamp', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
      },
    });
    (prismaMock.set.update as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
    });

    await service.toggleSetCompletion('user-1', 'se1', 'set-1', {
      isCompleted: true,
    });

    expect(prismaMock.set.update).toHaveBeenCalledWith({
      where: { id: 'set-1' },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
      },
    });
  });

  it('throws when toggling completion for missing set', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.toggleSetCompletion('user-1', 'se1', 'missing', {
        isCompleted: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('batch creates sets and returns count', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
    });

    const createSetSpy = jest
      .spyOn(service, 'createSet')
      .mockResolvedValueOnce({ id: 'set-1' } as never)
      .mockResolvedValueOnce({ id: 'set-2' } as never);

    await expect(
      service.batchCreateSets('user-1', 'se1', {
        sets: [
          {
            orderIndex: 0,
            type: 'WEIGHT_REPS',
            payload: {},
          },
          {
            orderIndex: 1,
            type: 'WEIGHT_REPS',
            payload: {},
          },
        ],
      }),
    ).resolves.toEqual({
      items: [{ id: 'set-1' }, { id: 'set-2' }],
      count: 2,
    });

    expect(createSetSpy).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'se1',
      expect.objectContaining({ orderIndex: 0 }),
    );
    expect(createSetSpy).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'se1',
      expect.objectContaining({ orderIndex: 1 }),
    );
  });

  it('throws forbidden when batch creating for inaccessible session exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.batchCreateSets('user-1', 'se1', {
        sets: [
          {
            orderIndex: 0,
            type: 'WEIGHT_REPS',
            payload: {},
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
