import {
  BadRequestException,
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
      exerciseTemplate: {
        findFirst: jest.fn(async () => ({ id: 'exercise-1' })),
        findMany: jest.fn(
          async (args?: {
            where?: {
              id?: {
                in?: string[];
              };
            };
          }) =>
            (args?.where?.id?.in ?? []).map((id) => ({
              id,
            })),
        ),
      },
      workoutTemplateExercise: {
        findMany: jest.fn(),
      },
      workoutTemplate: {
        findFirst: jest.fn(),
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
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      set: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg as Promise<unknown>[]);
      }
      if (typeof arg === 'function') {
        return (arg as (client: typeof prismaMock) => unknown)(prismaMock);
      }
      throw new Error('Unsupported transaction shape in test');
    });
    const prismaClientMock = prismaMock as unknown as PrismaService;

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
        prismaClientMock,
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

  it('starts a session from active workout template exercises only', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
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

    expect(prismaMock.workoutTemplateExercise.findMany).toHaveBeenCalledWith({
      where: {
        workoutTemplateId: 'template-1',
        exercise: {
          deletedAt: null,
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
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

  it('returns a started session with superset ordering applied', async () => {
    const { service, prismaMock, supersetMock } = createService();
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 'session-1',
      sessionExercises: [
        { id: 'se-1', orderIndex: 0, supersetGroupKey: null },
        { id: 'se-2', orderIndex: 1, supersetGroupKey: 'A' },
      ],
    });
    (supersetMock.interleave as jest.Mock).mockReturnValue([
      { id: 'se-2' },
      { id: 'se-1' },
    ]);

    await expect(
      service.startSession('user-1', {
        notes: 'inline',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 1,
            supersetGroupKey: 'A',
          },
        ],
      }),
    ).resolves.toEqual({
      id: 'session-1',
      sessionExercises: [{ id: 'se-2' }, { id: 'se-1' }],
    });
  });

  it('uses template exercise index when orderIndex is missing', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
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

  it('rejects template starts when the template no longer has active exercises to clone', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (
      prismaMock.workoutTemplateExercise.findMany as jest.Mock
    ).mockResolvedValue([]);

    await expect(
      service.startSession('user-1', {
        workoutTemplateId: 'template-1',
        notes: 'from template',
        exercises: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.workoutSession.create).not.toHaveBeenCalled();
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

  it('throws forbidden when starting a session from an inaccessible template', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.startSession('user-1', {
        workoutTemplateId: 'template-1',
        exercises: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.workoutSession.create).not.toHaveBeenCalled();
    expect(prismaMock.workoutTemplateExercise.findMany).not.toHaveBeenCalled();
  });

  it('throws forbidden when inline session contains inaccessible exercises', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111' },
    ]);

    await expect(
      service.startSession('user-1', {
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.workoutSession.create).not.toHaveBeenCalled();
  });

  it('rejects inline session starts with duplicate exercise order indexes', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.create as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });

    await expect(
      service.startSession('user-1', {
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.workoutSession.create).not.toHaveBeenCalled();
  });

  it('maps nested duplicate session-exercise orderIndex errors during startSession to a conflict error', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (
      prismaMock.workoutTemplateExercise.findMany as jest.Mock
    ).mockResolvedValue([
      {
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
        supersetGroupKey: null,
      },
      {
        exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
        orderIndex: 1,
        supersetGroupKey: null,
      },
    ]);
    (prismaMock.workoutSession.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['sessionId', 'orderIndex'],
      },
    });

    await expect(
      service.startSession('user-1', {
        workoutTemplateId: 'template-1',
        exercises: [],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SESSION_EXERCISE_ORDER_CONFLICT',
      },
    });
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
    (prismaMock.workoutSession.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'session-1',
        version: 2,
      })
      .mockResolvedValueOnce({
        id: 'session-1',
        version: 3,
      });
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
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

  it('throws conflict when session version changes after precheck and before write', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'session-1',
        version: 2,
      })
      .mockResolvedValueOnce({
        id: 'session-1',
        version: 3,
      });
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.updateSession('user-1', 'session-1', {
        version: 2,
        notes: 'stale write',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SESSION_VERSION_CONFLICT',
      },
    });
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
      status: 'IN_PROGRESS',
      endedReason: null,
    });
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prismaMock.workoutSession.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'session-1',
        userId: 'user-1',
        startedAt: new Date(Date.now() - 2000),
        status: 'IN_PROGRESS',
        endedReason: null,
      })
      .mockResolvedValueOnce({
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
    expect(streakMock.onSessionFinished).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      'UTC',
    );
  });

  it('finishes a session without warning when workout is fully complete', async () => {
    const { service, prismaMock, volumeMock, prDetectionMock, completionMock } =
      createService();

    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      startedAt: new Date(Date.now() - 2000),
      status: 'IN_PROGRESS',
      endedReason: 'USER_ENDED',
    });
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prismaMock.workoutSession.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'session-1',
        userId: 'user-1',
        startedAt: new Date(Date.now() - 2000),
        status: 'IN_PROGRESS',
        endedReason: 'USER_ENDED',
      })
      .mockResolvedValueOnce({
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

  it('throws conflict when finishing an already-finished session', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      startedAt: new Date(Date.now() - 2000),
      status: 'FINISHED',
      endedReason: 'USER_ENDED',
    });

    await expect(
      service.finishSession('user-1', 'session-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.workoutSession.updateMany).not.toHaveBeenCalled();
  });

  it('does not mark session finished when a finish side-effect fails', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      startedAt: new Date(Date.now() - 2000),
      status: 'IN_PROGRESS',
      endedReason: null,
      user: {
        timezone: 'UTC',
      },
    });
    (prismaMock.workoutSession.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    (volumeMock.cacheSessionVolume as jest.Mock).mockRejectedValue(
      new Error('cache failed'),
    );

    await expect(service.finishSession('user-1', 'session-1')).rejects.toThrow(
      'cache failed',
    );

    expect(prismaMock.workoutSession.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.workoutSession.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'session-1',
          status: 'IN_PROGRESS',
        }),
        data: expect.objectContaining({
          status: 'FINISHED',
        }),
      }),
    );
    expect(prismaMock.workoutSession.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'session-1',
          status: 'FINISHED',
        }),
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
          finishedAt: null,
          durationSeconds: null,
        }),
      }),
    );
  });

  it('runs finish side effects only once when concurrent finish requests race', async () => {
    const {
      service,
      prismaMock,
      volumeMock,
      prDetectionMock,
      completionMock,
      streakMock,
    } = createService();
    const existing = {
      id: 'session-1',
      userId: 'user-1',
      startedAt: new Date(Date.now() - 2000),
      status: 'IN_PROGRESS',
      endedReason: 'USER_ENDED',
      user: {
        timezone: 'UTC',
      },
    };
    (prismaMock.workoutSession.findFirst as jest.Mock).mockImplementation(
      async (args?: { select?: { startedAt?: boolean; status?: boolean } }) => {
        if (args?.select?.startedAt) {
          return existing;
        }
        if (args?.select?.status) {
          return { status: 'FINISHED' };
        }

        return { id: 'session-1', status: 'FINISHED' };
      },
    );
    (prismaMock.workoutSession.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    (volumeMock.cacheSessionVolume as jest.Mock).mockResolvedValue(1000);
    (prDetectionMock.detectForSession as jest.Mock).mockResolvedValue([]);
    (completionMock.calculate as jest.Mock).mockResolvedValue({
      totalSets: 2,
      completedSets: 2,
      isIncomplete: false,
    });
    (streakMock.onSessionFinished as jest.Mock).mockResolvedValue(undefined);

    const results = await Promise.allSettled([
      service.finishSession('user-1', 'session-1'),
      service.finishSession('user-1', 'session-1'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledTimes(1);
    expect(prDetectionMock.detectForSession).toHaveBeenCalledTimes(1);
    expect(streakMock.onSessionFinished).toHaveBeenCalledTimes(1);
    expect(completionMock.calculate).toHaveBeenCalledTimes(1);
  });

  it('throws when session disappears before the guarded finish write', async () => {
    const {
      service,
      prismaMock,
      volumeMock,
      prDetectionMock,
      completionMock,
      streakMock,
    } = createService();

    (prismaMock.workoutSession.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'session-1',
        userId: 'user-1',
        startedAt: new Date(Date.now() - 2000),
        status: 'IN_PROGRESS',
        endedReason: null,
        user: {
          timezone: 'UTC',
        },
      })
      .mockResolvedValueOnce(null);
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });
    (volumeMock.cacheSessionVolume as jest.Mock).mockResolvedValue(100);
    (prDetectionMock.detectForSession as jest.Mock).mockResolvedValue([]);
    (completionMock.calculate as jest.Mock).mockResolvedValue({
      totalSets: 1,
      completedSets: 1,
      isIncomplete: false,
    });
    (streakMock.onSessionFinished as jest.Mock).mockResolvedValue(undefined);

    await expect(
      service.finishSession('user-1', 'session-1'),
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

  it('nulls soft-deleted workout templates in session listings', async () => {
    const { service, prismaMock } = createService();
    const deletedAt = new Date('2026-03-05T00:00:00.000Z');
    (prismaMock.workoutSession.findMany as jest.Mock).mockResolvedValue([
      {
        id: 's1',
        workoutTemplate: {
          id: 'template-1',
          deletedAt,
        },
      },
    ]);
    (prismaMock.workoutSession.count as jest.Mock).mockResolvedValue(1);

    await expect(
      service.listSessions('user-1', {
        page: 1,
        pageSize: 10,
        templateId: undefined,
        startDate: undefined,
        endDate: undefined,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 's1',
          workoutTemplate: null,
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1 },
    });
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

  it('returns active session with superset ordering applied', async () => {
    const { service, prismaMock, supersetMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'active-1',
      sessionExercises: [
        { id: 'se-1', orderIndex: 0, supersetGroupKey: null },
        { id: 'se-2', orderIndex: 1, supersetGroupKey: 'A' },
      ],
    });
    (supersetMock.interleave as jest.Mock).mockReturnValue([
      { id: 'se-2' },
      { id: 'se-1' },
    ]);

    await expect(service.getActiveSession('user-1')).resolves.toEqual({
      id: 'active-1',
      sessionExercises: [{ id: 'se-2' }, { id: 'se-1' }],
    });
    expect(supersetMock.interleave).toHaveBeenCalledWith([
      {
        supersetGroupKey: null,
        orderIndex: 0,
        item: { id: 'se-1', orderIndex: 0, supersetGroupKey: null },
      },
      {
        supersetGroupKey: 'A',
        orderIndex: 1,
        item: { id: 'se-2', orderIndex: 1, supersetGroupKey: 'A' },
      },
    ]);
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

  it('recalculates PRs for exercises in a soft-deleted session', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prismaMock.sessionExercise.findMany as jest.Mock).mockResolvedValue([
      { exerciseTemplateId: 'exercise-1' },
      { exerciseTemplateId: 'exercise-1' },
      { exerciseTemplateId: 'exercise-2' },
    ]);

    await service.softDeleteSession('user-1', 'session-1');

    expect(prismaMock.sessionExercise.findMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'session-1',
        deletedAt: null,
      },
      select: {
        exerciseTemplateId: true,
      },
    });
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledTimes(2);
    expect(prDetectionMock.recalculateForExercise).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'exercise-1',
    );
    expect(prDetectionMock.recalculateForExercise).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'exercise-2',
    );
  });

  it('throws when deleting missing session', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.softDeleteSession('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.sessionExercise.findMany).not.toHaveBeenCalled();
    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
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

  it('recaches volume when adding an exercise to a finished session', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
      status: 'FINISHED',
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

    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
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

  it('throws forbidden when adding inaccessible exercise template to session', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });
    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      service.addSessionExercise('user-1', 'session-1', {
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.sessionExercise.create).not.toHaveBeenCalled();
  });

  it('maps duplicate session-exercise orderIndex writes to a conflict error', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });
    (prismaMock.sessionExercise.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['sessionId', 'orderIndex'],
      },
    });

    await expect(
      service.addSessionExercise('user-1', 'session-1', {
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SESSION_EXERCISE_ORDER_CONFLICT',
      },
    });
  });

  it('updates session exercise with version check', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'se1',
        version: 2,
      })
      .mockResolvedValueOnce({
        id: 'se1',
        version: 3,
      });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.updateSessionExercise('user-1', 'session-1', 'se1', {
        version: 2,
        orderIndex: 4,
      }),
    ).resolves.toEqual({ id: 'se1', version: 3 });
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

  it('throws conflict when session exercise version changes after precheck and before write', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'se1',
        version: 2,
      })
      .mockResolvedValueOnce({
        id: 'se1',
        version: 3,
      });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.updateSessionExercise('user-1', 'session-1', 'se1', {
        version: 2,
        orderIndex: 4,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SESSION_EXERCISE_VERSION_CONFLICT',
      },
    });
  });

  it('maps duplicate session-exercise orderIndex updates to a conflict error', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      version: 2,
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['sessionId', 'orderIndex'],
      },
    });

    await expect(
      service.updateSessionExercise('user-1', 'session-1', 'se1', {
        orderIndex: 4,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SESSION_EXERCISE_ORDER_CONFLICT',
      },
    });
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
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.deleteSessionExercise('user-1', 'session-1', 'se1'),
    ).resolves.toEqual({ success: true });
  });

  it('recalculates PRs and recaches finished-session volume when deleting a session exercise', async () => {
    const { service, prismaMock, prDetectionMock, volumeMock } =
      createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'FINISHED',
      },
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await service.deleteSessionExercise('user-1', 'session-1', 'se1');

    expect(prismaMock.sessionExercise.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'se1',
        sessionId: 'session-1',
        deletedAt: null,
        session: {
          userId: 'user-1',
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
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
  });

  it('skips volume recache when deleting a session exercise from an in-progress session', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await service.deleteSessionExercise('user-1', 'session-1', 'se1');

    expect(volumeMock.cacheSessionVolume).not.toHaveBeenCalled();
  });

  it('throws when deleting a missing session exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.deleteSessionExercise('user-1', 'session-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.sessionExercise.updateMany).not.toHaveBeenCalled();
  });

  it('throws when session exercise is deleted concurrently before deleteSessionExercise update applies', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.deleteSessionExercise('user-1', 'session-1', 'se1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reorders session exercises in a transaction', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });
    (prismaMock.sessionExercise.count as jest.Mock).mockResolvedValue(1);
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.reorderSessionExercises('user-1', 'session-1', {
        items: [{ id: 'se1', orderIndex: 9 }],
      }),
    ).resolves.toEqual({ success: true });

    expect(prismaMock.sessionExercise.count).toHaveBeenCalledWith({
      where: {
        id: { in: ['se1'] },
        sessionId: 'session-1',
        deletedAt: null,
      },
    });
    expect(prismaMock.sessionExercise.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'se1',
        sessionId: 'session-1',
        deletedAt: null,
        session: {
          userId: 'user-1',
          deletedAt: null,
        },
      },
      data: { orderIndex: 9 },
    });
  });

  it('throws when reorder payload includes missing session exercises', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });
    (prismaMock.sessionExercise.count as jest.Mock).mockResolvedValue(1);

    await expect(
      service.reorderSessionExercises('user-1', 'session-1', {
        items: [
          { id: 'se1', orderIndex: 1 },
          { id: 'missing', orderIndex: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.sessionExercise.count).toHaveBeenCalledWith({
      where: {
        id: { in: ['se1', 'missing'] },
        sessionId: 'session-1',
        deletedAt: null,
      },
    });
    expect(prismaMock.sessionExercise.updateMany).not.toHaveBeenCalled();
  });

  it('reorders session exercises without transient unique collisions when swapping indexes', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'session-1',
    });
    (prismaMock.sessionExercise.count as jest.Mock).mockResolvedValue(2);
    let updateCalls = 0;
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockImplementation(
      async (args: { data: { orderIndex: number } }) => {
        updateCalls += 1;
        if (updateCalls === 1 && args.data.orderIndex === 1) {
          throw {
            code: 'P2002',
            meta: {
              target: ['sessionId', 'orderIndex'],
            },
          };
        }

        return { count: 1 };
      },
    );

    await expect(
      service.reorderSessionExercises('user-1', 'session-1', {
        items: [
          { id: 'se1', orderIndex: 1 },
          { id: 'se2', orderIndex: 0 },
        ],
      }),
    ).resolves.toEqual({ success: true });
  });

  it('swaps session exercise template and recalculates PRs for old/new templates', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-old',
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.swapSessionExercise('user-1', 'session-1', {
        fromExerciseId: 'se1',
        toExerciseTemplateId: 'exercise-new',
      }),
    ).resolves.toMatchObject({ id: 'se1' });

    expect(prismaMock.sessionExercise.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'se1',
        sessionId: 'session-1',
        session: {
          userId: 'user-1',
          deletedAt: null,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        exerciseTemplateId: true,
      },
    });
    expect(prismaMock.sessionExercise.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'se1',
        sessionId: 'session-1',
        deletedAt: null,
        session: {
          userId: 'user-1',
          deletedAt: null,
        },
      },
      data: {
        exerciseTemplateId: 'exercise-new',
        version: { increment: 1 },
      },
    });
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledTimes(2);
    expect(prDetectionMock.recalculateForExercise).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'exercise-old',
    );
    expect(prDetectionMock.recalculateForExercise).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'exercise-new',
    );
  });

  it('returns the refreshed session exercise after swap', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'se1',
        exerciseTemplateId: 'exercise-old',
      })
      .mockResolvedValueOnce({
        id: 'se1',
        exerciseTemplateId: 'exercise-new',
        orderIndex: 3,
        notes: 'updated',
        version: 2,
      });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(
      service.swapSessionExercise('user-1', 'session-1', {
        fromExerciseId: 'se1',
        toExerciseTemplateId: 'exercise-new',
      }),
    ).resolves.toEqual({
      id: 'se1',
      exerciseTemplateId: 'exercise-new',
      orderIndex: 3,
      notes: 'updated',
      version: 2,
    });
  });

  it('throws forbidden when swap replacement exercise is inaccessible', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
    });
    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      service.swapSessionExercise('user-1', 'session-1', {
        fromExerciseId: 'se1',
        toExerciseTemplateId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.sessionExercise.updateMany).not.toHaveBeenCalled();
  });

  it('recalculates PRs once when swap keeps the same exercise template id', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await service.swapSessionExercise('user-1', 'session-1', {
      fromExerciseId: 'se1',
      toExerciseTemplateId: 'exercise-1',
    });

    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledTimes(1);
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
  });

  it('throws when swap target disappears before the write', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-old',
    });
    (prismaMock.sessionExercise.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.swapSessionExercise('user-1', 'session-1', {
        fromExerciseId: 'se1',
        toExerciseTemplateId: 'exercise-new',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
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
      exerciseTemplateId: 'exercise-1',
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
    expect(prismaMock.sessionExercise.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: {
            userId: 'user-1',
            deletedAt: null,
          },
        }),
      }),
    );
  });

  it('creates set with idempotency key when no prior set exists', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
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
      exerciseTemplateId: 'exercise-1',
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
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
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

  it('ignores soft-deleted idempotent matches before creating a set', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock).mockImplementation(
      async (args?: { where?: { deletedAt?: null } }) =>
        args?.where?.deletedAt === null
          ? null
          : {
              id: 'deleted-set',
              deletedAt: new Date('2026-03-06T00:00:00.000Z'),
            },
    );
    (prismaMock.set.create as jest.Mock).mockResolvedValue({
      id: 'new-set',
      isCompleted: false,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          userId: 'user-1',
          status: 'IN_PROGRESS',
        },
      },
    });

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-soft-deleted',
      }),
    ).resolves.toMatchObject({ id: 'new-set' });
  });

  it('returns existing set when idempotent create races and unique constraint is hit', async () => {
    const { service, prismaMock } = createService();
    const existingSet = { id: 'existing-set', isCompleted: true };
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingSet);
    (prismaMock.set.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['sessionExerciseId', 'idempotencyKey'],
      },
    });

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-race-1',
      }),
    ).resolves.toEqual(existingSet);

    expect(prismaMock.set.findFirst).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-idempotency unique constraint errors during createSet', async () => {
    const { service, prismaMock } = createService();
    const dbError = {
      code: 'P2002',
      meta: {
        target: ['someOtherUniqueKey'],
      },
    };
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockRejectedValue(dbError);

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-race-2',
      }),
    ).rejects.toEqual(dbError);
  });

  it('maps duplicate set orderIndex creates to a conflict error', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['sessionExerciseId', 'orderIndex'],
      },
    });

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SET_ORDER_CONFLICT',
      },
    });
  });

  it('handles idempotency unique constraint errors when Prisma target is returned as a string', async () => {
    const { service, prismaMock } = createService();
    const existingSet = {
      id: 'existing-set-string-target',
      isCompleted: false,
    };
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingSet);
    (prismaMock.set.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: 'Set_sessionExerciseId_idempotencyKey_key',
      },
    });

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-race-3',
      }),
    ).resolves.toEqual(existingSet);
  });

  it('rethrows idempotency unique errors when collision refetch returns no existing row', async () => {
    const { service, prismaMock } = createService();
    const dbError = {
      code: 'P2002',
      meta: {
        target: ['sessionExerciseId', 'idempotencyKey'],
      },
    };
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prismaMock.set.create as jest.Mock).mockRejectedValue(dbError);

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-race-7',
      }),
    ).rejects.toEqual(dbError);
  });

  it('ignores soft-deleted rows when refetching an idempotency race', async () => {
    const { service, prismaMock } = createService();
    const dbError = {
      code: 'P2002',
      meta: {
        target: ['sessionExerciseId', 'idempotencyKey'],
      },
    };
    let findFirstCalls = 0;
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock).mockImplementation(
      async (args?: { where?: { deletedAt?: null } }) => {
        findFirstCalls += 1;
        if (findFirstCalls === 1) {
          return null;
        }

        return args?.where?.deletedAt === null
          ? null
          : {
              id: 'deleted-race-set',
              deletedAt: new Date('2026-03-06T00:00:00.000Z'),
            };
      },
    );
    (prismaMock.set.create as jest.Mock).mockRejectedValue(dbError);

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-soft-deleted-race',
      }),
    ).rejects.toEqual(dbError);
  });

  it('rethrows non-object errors during idempotent create', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockRejectedValue('boom');

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-race-4',
      }),
    ).rejects.toEqual('boom');
  });

  it('rethrows non-P2002 object errors during idempotent create', async () => {
    const { service, prismaMock } = createService();
    const dbError = {
      code: 'P5000',
      meta: {
        target: ['sessionExerciseId', 'idempotencyKey'],
      },
    };
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockRejectedValue(dbError);

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-race-5',
      }),
    ).rejects.toEqual(dbError);
  });

  it('rethrows P2002 errors with unsupported target metadata during idempotent create', async () => {
    const { service, prismaMock } = createService();
    const dbError = {
      code: 'P2002',
      meta: {},
    };
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: {
        id: 'session-1',
        status: 'IN_PROGRESS',
      },
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockRejectedValue(dbError);

    await expect(
      service.createSet('user-1', 'se1', {
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        idempotencyKey: 'idem-race-6',
      }),
    ).rejects.toEqual(dbError);
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

  it('recaches volume when creating a set for a finished session', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
    });
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.set.create as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', userId: 'user-1', status: 'FINISHED' },
      },
    });

    await service.createSet('user-1', 'se1', {
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {},
      isCompleted: false,
    });

    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
  });

  it('updates set and refreshes volume for finished sessions', async () => {
    const { service, prismaMock, volumeMock, prDetectionMock } =
      createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
      completedAt: new Date('2024-01-01T10:00:00.000Z'),
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'FINISHED',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (volumeMock.cacheSessionVolume as jest.Mock).mockResolvedValue(1000);

    await expect(
      service.updateSet('user-1', 'se1', 'set-1', {
        isCompleted: true,
      }),
    ).resolves.toMatchObject({ id: 'set-1' });

    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
    expect(prismaMock.set.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            deletedAt: null,
            session: {
              userId: 'user-1',
              deletedAt: null,
            },
          },
        }),
      }),
    );
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.updateSet('user-1', 'se1', 'set-1', {
      isCompleted: true,
      completedAt: '2024-01-03T10:00:00.000Z',
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'set-1',
          sessionExerciseId: 'se1',
          deletedAt: null,
          sessionExercise: {
            deletedAt: null,
            session: {
              userId: 'user-1',
              deletedAt: null,
            },
          },
        }),
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.updateSet('user-1', 'se1', 'set-1', {
      isCompleted: false,
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'set-1',
          sessionExerciseId: 'se1',
          deletedAt: null,
        }),
        data: expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      }),
    );
  });

  it('skips PR recalculation when updateSet changes only non-PR fields', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.updateSet('user-1', 'se1', 'set-1', {
      rpe: 7.5,
    });

    const updateCall = (prismaMock.set.updateMany as jest.Mock).mock
      .calls[0][0];
    expect(updateCall.data).not.toHaveProperty('isCompleted');
    expect(updateCall.data).not.toHaveProperty('completedAt');
    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
  });

  it('updates set from completedAt only, recalculates PRs, and skips volume for in-progress sessions', async () => {
    const { service, prismaMock, volumeMock, prDetectionMock } =
      createService();
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.updateSet('user-1', 'se1', 'set-1', {
      completedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'set-1',
          sessionExerciseId: 'se1',
          deletedAt: null,
        }),
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: new Date('2024-01-01T00:00:00.000Z'),
        }),
      }),
    );
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
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

  it('throws when updateSet target disappears before the write', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
      completedAt: null,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      service.updateSet('user-1', 'se1', 'set-1', { reps: 8 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
  });

  it('maps duplicate set orderIndex updates to a conflict error', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
      completedAt: null,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['sessionExerciseId', 'orderIndex'],
      },
    });

    await expect(
      service.updateSet('user-1', 'se1', 'set-1', {
        orderIndex: 2,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SET_ORDER_CONFLICT',
      },
    });
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await expect(service.deleteSet('user-1', 'se1', 'set-1')).resolves.toEqual({
      success: true,
    });
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
    expect(prismaMock.set.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            deletedAt: null,
            session: {
              userId: 'user-1',
              deletedAt: null,
            },
          },
        }),
      }),
    );
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

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

  it('throws when deleteSet target disappears before the write', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', status: 'IN_PROGRESS' },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      service.deleteSet('user-1', 'se1', 'set-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
  });

  it('toggles set completion and recalculates PRs', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await expect(
      service.toggleSetCompletion('user-1', 'se1', 'set-1', {
        isCompleted: false,
      }),
    ).resolves.toMatchObject({ id: 'set-1', isCompleted: false });

    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
    expect(prismaMock.set.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            deletedAt: null,
            session: {
              userId: 'user-1',
              deletedAt: null,
            },
          },
        }),
      }),
    );
  });

  it('recaches volume when toggling set completion for a finished session', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
      completedAt: null,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'FINISHED',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.toggleSetCompletion('user-1', 'se1', 'set-1', {
      isCompleted: true,
    });

    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
  });

  it('toggles completion to true and stores a completion timestamp', async () => {
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
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.toggleSetCompletion('user-1', 'se1', 'set-1', {
      isCompleted: true,
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'set-1',
        sessionExerciseId: 'se1',
        deletedAt: null,
        sessionExercise: {
          deletedAt: null,
          session: {
            userId: 'user-1',
            deletedAt: null,
          },
        },
      },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
      },
    });
  });

  it('preserves existing completedAt when updating a completed set without a new timestamp', async () => {
    const { service, prismaMock } = createService();
    const existingCompletedAt = new Date('2024-01-01T10:00:00.000Z');
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
      completedAt: existingCompletedAt,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.updateSet('user-1', 'se1', 'set-1', {
      isCompleted: true,
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'set-1',
          sessionExerciseId: 'se1',
          deletedAt: null,
        }),
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: existingCompletedAt,
        }),
      }),
    );
  });

  it('generates completedAt when updating a completed set that is missing timestamp', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
      completedAt: null,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.updateSet('user-1', 'se1', 'set-1', {
      isCompleted: true,
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'set-1',
          sessionExerciseId: 'se1',
          deletedAt: null,
        }),
        data: expect.objectContaining({
          isCompleted: true,
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('preserves completedAt when toggling an already completed set to true', async () => {
    const { service, prismaMock } = createService();
    const existingCompletedAt = new Date('2024-01-01T10:00:00.000Z');
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
      completedAt: existingCompletedAt,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.toggleSetCompletion('user-1', 'se1', 'set-1', {
      isCompleted: true,
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'set-1',
        sessionExerciseId: 'se1',
        deletedAt: null,
        sessionExercise: {
          deletedAt: null,
          session: {
            userId: 'user-1',
            deletedAt: null,
          },
        },
      },
      data: {
        isCompleted: true,
        completedAt: existingCompletedAt,
      },
    });
  });

  it('generates completedAt when toggling a completed set that has null timestamp', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
      completedAt: null,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.toggleSetCompletion('user-1', 'se1', 'set-1', {
      isCompleted: true,
    });

    expect(prismaMock.set.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'set-1',
        sessionExerciseId: 'se1',
        deletedAt: null,
        sessionExercise: {
          deletedAt: null,
          session: {
            userId: 'user-1',
            deletedAt: null,
          },
        },
      },
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

  it('throws when toggleSetCompletion target disappears before the write', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.set.findFirst as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
      completedAt: null,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
      },
    });
    (prismaMock.set.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      service.toggleSetCompletion('user-1', 'se1', 'set-1', {
        isCompleted: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
  });

  it('batch creates sets and returns count', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: { id: 'session-1', userId: 'user-1' },
    });
    (prismaMock.set.create as jest.Mock)
      .mockResolvedValueOnce({
        id: 'set-1',
        isCompleted: false,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          session: { id: 'session-1', userId: 'user-1' },
        },
      })
      .mockResolvedValueOnce({
        id: 'set-2',
        isCompleted: false,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          session: { id: 'session-1', userId: 'user-1' },
        },
      });

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
    ).resolves.toEqual(
      expect.objectContaining({
        count: 2,
        items: [
          expect.objectContaining({ id: 'set-1' }),
          expect.objectContaining({ id: 'set-2' }),
        ],
      }),
    );

    expect(prismaMock.set.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('batch creates sets in parallel instead of waiting for each create serially', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: { id: 'session-1', userId: 'user-1' },
    });

    let resolveFirstCreate:
      | ((value: {
          id: string;
          isCompleted: boolean;
          sessionExercise: {
            exerciseTemplateId: string;
            session: { id: string; userId: string };
          };
        }) => void)
      | undefined;
    (prismaMock.set.create as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstCreate = resolve;
          }),
      )
      .mockResolvedValueOnce({
        id: 'set-2',
        isCompleted: false,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          session: { id: 'session-1', userId: 'user-1' },
        },
      });

    const pending = service.batchCreateSets('user-1', 'se1', {
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
    });

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(prismaMock.set.create).toHaveBeenCalledTimes(2);

    resolveFirstCreate?.({
      id: 'set-1',
      isCompleted: false,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', userId: 'user-1' },
      },
    });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        count: 2,
      }),
    );
  });

  it('batch recalculates PRs once for multiple completed sets on same exercise', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: { id: 'session-1', userId: 'user-1' },
    });
    (prismaMock.set.create as jest.Mock)
      .mockResolvedValueOnce({
        id: 'set-1',
        isCompleted: true,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          session: { id: 'session-1', userId: 'user-1' },
        },
      })
      .mockResolvedValueOnce({
        id: 'set-2',
        isCompleted: true,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          session: { id: 'session-1', userId: 'user-1' },
        },
      });

    await service.batchCreateSets('user-1', 'se1', {
      sets: [
        {
          orderIndex: 0,
          type: 'WEIGHT_REPS',
          payload: {},
          isCompleted: true,
        },
        {
          orderIndex: 1,
          type: 'WEIGHT_REPS',
          payload: {},
          isCompleted: true,
        },
      ],
    });

    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledTimes(1);
    expect(prDetectionMock.recalculateForExercise).toHaveBeenCalledWith(
      'user-1',
      'exercise-1',
    );
  });

  it('does not recalculate PRs for batch when no new completed sets were created', async () => {
    const { service, prismaMock, prDetectionMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: { id: 'session-1', userId: 'user-1' },
    });
    (prismaMock.set.create as jest.Mock)
      .mockResolvedValueOnce({
        id: 'set-1',
        isCompleted: false,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          session: { id: 'session-1', userId: 'user-1' },
        },
      })
      .mockResolvedValueOnce({
        id: 'set-2',
        isCompleted: false,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          session: { id: 'session-1', userId: 'user-1' },
        },
      });

    await service.batchCreateSets('user-1', 'se1', {
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
    });

    expect(prDetectionMock.recalculateForExercise).not.toHaveBeenCalled();
  });

  it('recaches volume after batch create for a finished session', async () => {
    const { service, prismaMock, volumeMock } = createService();
    (prismaMock.sessionExercise.findFirst as jest.Mock).mockResolvedValue({
      id: 'se1',
      exerciseTemplateId: 'exercise-1',
      session: { id: 'session-1', userId: 'user-1', status: 'FINISHED' },
    });
    (prismaMock.set.create as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: false,
      sessionExercise: {
        exerciseTemplateId: 'exercise-1',
        session: { id: 'session-1', userId: 'user-1', status: 'FINISHED' },
      },
    });

    await service.batchCreateSets('user-1', 'se1', {
      sets: [
        {
          orderIndex: 0,
          type: 'WEIGHT_REPS',
          payload: {},
        },
      ],
    });

    expect(volumeMock.cacheSessionVolume).toHaveBeenCalledWith('session-1');
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
