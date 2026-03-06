import { Test } from '@nestjs/testing';
import { PrType } from '@prisma/client';

import * as oneRmUtils from '../common/utils/one-rm';
import { PrismaService } from '../prisma/prisma.service';
import { PrDetectionService } from './pr-detection.service';

jest.mock('../common/utils/one-rm', () => {
  const actual = jest.requireActual<typeof import('../common/utils/one-rm')>(
    '../common/utils/one-rm',
  );
  return {
    ...actual,
    estimateOneRm: jest.fn(actual.estimateOneRm),
  };
});

type DetectedPr = Awaited<
  ReturnType<PrDetectionService['detectForSession']>
>[number];

interface SessionSetFixture {
  id: string;
  weight: number | null;
  reps: number | null;
  completedAt: Date | null;
  sessionExercise: {
    exerciseTemplateId: string;
  };
}

describe('PrDetectionService', () => {
  it('loads existing PR records in one query and upserts only improved values', async () => {
    const completedAt = new Date('2024-01-01T10:00:00.000Z');
    const sessionSets: SessionSetFixture[] = [
      {
        id: 'set-1',
        weight: 100,
        reps: 5,
        completedAt,
        sessionExercise: { exerciseTemplateId: 'exercise-1' },
      },
    ];
    const existingPrRecords: DetectedPr[] = [
      {
        exerciseTemplateId: 'exercise-1',
        prType: PrType.MAX_WEIGHT,
        value: 110,
      },
      {
        exerciseTemplateId: 'exercise-1',
        prType: PrType.MAX_REPS,
        value: 5,
      },
      {
        exerciseTemplateId: 'exercise-1',
        prType: PrType.MAX_VOLUME,
        value: 450,
      },
      {
        exerciseTemplateId: 'exercise-1',
        prType: PrType.MAX_1RM_EST,
        value: 120,
      },
    ];

    const prismaMock = {
      set: {
        findMany: jest.fn(async () => sessionSets),
      },
      $transaction: jest.fn(async () => undefined),
      pRRecord: {
        findMany: jest.fn(async () => existingPrRecords),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    const result = await service.detectForSession('user-1', 'session-1');

    expect((prismaMock.pRRecord.findMany as jest.Mock).mock.calls.length).toBe(
      1,
    );
    expect((prismaMock.pRRecord.upsert as jest.Mock).mock.calls.length).toBe(1);
    expect((prismaMock.$transaction as jest.Mock).mock.calls.length).toBe(1);
    expect(
      (prismaMock.$transaction as jest.Mock).mock.calls[0][0],
    ).toHaveLength(1);
    expect(
      (prismaMock.pRRecord.upsert as jest.Mock).mock.calls[0][0],
    ).toMatchObject({
      where: {
        userId_exerciseTemplateId_prType: {
          userId: 'user-1',
          exerciseTemplateId: 'exercise-1',
          prType: PrType.MAX_VOLUME,
        },
      },
      update: {
        value: 500,
        setId: 'set-1',
        sessionId: 'session-1',
      },
    });
    expect(result).toEqual([
      {
        exerciseTemplateId: 'exercise-1',
        prType: PrType.MAX_VOLUME,
        value: 500,
      },
    ]);
  });

  it('returns empty array when session has no completed sets', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => []),
      },
      pRRecord: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await expect(
      service.detectForSession('user-1', 'session-1'),
    ).resolves.toEqual([]);
    expect(prismaMock.pRRecord.findMany).not.toHaveBeenCalled();
    expect(prismaMock.pRRecord.upsert).not.toHaveBeenCalled();
  });

  it('filters out sets from soft-deleted session exercises in detectForSession query', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => []),
      },
      pRRecord: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await service.detectForSession('user-1', 'session-1');

    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: expect.objectContaining({
            sessionId: 'session-1',
            deletedAt: null,
            session: {
              userId: 'user-1',
              deletedAt: null,
            },
          }),
        }),
      }),
    );
  });

  it('skips candidate types with non-positive values', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: null,
            reps: null,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
            sessionExercise: { exerciseTemplateId: 'exercise-1' },
          },
        ]),
      },
      $transaction: jest.fn(async () => undefined),
      pRRecord: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await expect(
      service.detectForSession('user-1', 'session-1'),
    ).resolves.toEqual([]);
    expect(prismaMock.pRRecord.upsert).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates a PR when no existing value exists for that exercise/type', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 0,
            reps: 8,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
            sessionExercise: { exerciseTemplateId: 'exercise-1' },
          },
        ]),
      },
      $transaction: jest.fn(async () => undefined),
      pRRecord: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    const result = await service.detectForSession('user-1', 'session-1');

    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_exerciseTemplateId_prType: {
            userId: 'user-1',
            exerciseTemplateId: 'exercise-1',
            prType: PrType.MAX_REPS,
          },
        },
      }),
    );
    expect(result).toContainEqual({
      exerciseTemplateId: 'exercise-1',
      prType: PrType.MAX_REPS,
      value: 8,
    });
  });

  it('groups by exercise and only upserts improved PR types', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 100,
            reps: 5,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
            sessionExercise: { exerciseTemplateId: 'exercise-1' },
          },
          {
            id: 'set-2',
            weight: 80,
            reps: 10,
            completedAt: new Date('2024-01-01T11:00:00.000Z'),
            sessionExercise: { exerciseTemplateId: 'exercise-2' },
          },
        ]),
      },
      $transaction: jest.fn(async () => undefined),
      pRRecord: {
        findMany: jest.fn(async () => [
          {
            exerciseTemplateId: 'exercise-1',
            prType: PrType.MAX_VOLUME,
            value: 450,
          },
          {
            exerciseTemplateId: 'exercise-2',
            prType: PrType.MAX_WEIGHT,
            value: 100,
          },
          {
            exerciseTemplateId: 'exercise-2',
            prType: PrType.MAX_REPS,
            value: 9,
          },
          {
            exerciseTemplateId: 'exercise-2',
            prType: PrType.MAX_VOLUME,
            value: 700,
          },
        ]),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    const result = await service.detectForSession('user-1', 'session-1');

    expect(result).toEqual(
      expect.arrayContaining([
        {
          exerciseTemplateId: 'exercise-1',
          prType: PrType.MAX_VOLUME,
          value: 500,
        },
        {
          exerciseTemplateId: 'exercise-2',
          prType: PrType.MAX_REPS,
          value: 10,
        },
        {
          exerciseTemplateId: 'exercise-2',
          prType: PrType.MAX_VOLUME,
          value: 800,
        },
      ]),
    );
    expect(result).not.toContainEqual(
      expect.objectContaining({
        exerciseTemplateId: 'exercise-2',
        prType: PrType.MAX_WEIGHT,
      }),
    );
  });

  it('aggregates multiple sets for the same exercise within one session', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 60,
            reps: 6,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
            sessionExercise: { exerciseTemplateId: 'exercise-1' },
          },
          {
            id: 'set-2',
            weight: 70,
            reps: 4,
            completedAt: new Date('2024-01-01T10:05:00.000Z'),
            sessionExercise: { exerciseTemplateId: 'exercise-1' },
          },
        ]),
      },
      $transaction: jest.fn(async () => undefined),
      pRRecord: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    const result = await service.detectForSession('user-1', 'session-1');

    expect(result).toEqual(
      expect.arrayContaining([
        {
          exerciseTemplateId: 'exercise-1',
          prType: PrType.MAX_WEIGHT,
          value: 70,
        },
      ]),
    );
  });

  it('ignores completed sets without completedAt when detecting PRs', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 100,
            reps: 5,
            completedAt: null,
            sessionExercise: { exerciseTemplateId: 'exercise-1' },
          },
        ]),
      },
      $transaction: jest.fn(async () => undefined),
      pRRecord: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await expect(
      service.detectForSession('user-1', 'session-1'),
    ).resolves.toEqual([]);
    expect(prismaMock.pRRecord.upsert).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('uses shared estimateOneRm utility when evaluating 1RM candidates', async () => {
    const estimateSpy = oneRmUtils.estimateOneRm as unknown as jest.Mock;
    estimateSpy.mockClear();

    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 100,
            reps: 5,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
            sessionExercise: { exerciseTemplateId: 'exercise-1' },
          },
        ]),
      },
      $transaction: jest.fn(async () => undefined),
      pRRecord: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await service.detectForSession('user-1', 'session-1');

    expect(estimateSpy).toHaveBeenCalledWith(100, 5);
  });

  it('recalculates and upserts current PRs for one exercise', async () => {
    const transaction = jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 100,
            reps: 5,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
            sessionExercise: { sessionId: 'session-1' },
          },
          {
            id: 'set-2',
            weight: 0,
            reps: 10,
            completedAt: new Date('2024-01-02T10:00:00.000Z'),
            sessionExercise: { sessionId: 'session-2' },
          },
          {
            id: 'set-3',
            weight: 90,
            reps: 4,
            completedAt: null,
            sessionExercise: { sessionId: 'session-3' },
          },
        ]),
      },
      $transaction: transaction,
      pRRecord: {
        upsert: jest.fn(async () => undefined),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await service.recalculateForExercise('user-1', 'exercise-1');

    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_exerciseTemplateId_prType: {
            userId: 'user-1',
            exerciseTemplateId: 'exercise-1',
            prType: PrType.MAX_WEIGHT,
          },
        },
      }),
    );
    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_exerciseTemplateId_prType: {
            userId: 'user-1',
            exerciseTemplateId: 'exercise-1',
            prType: PrType.MAX_REPS,
          },
        },
      }),
    );
    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_exerciseTemplateId_prType: {
            userId: 'user-1',
            exerciseTemplateId: 'exercise-1',
            prType: PrType.MAX_VOLUME,
          },
        },
      }),
    );
    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_exerciseTemplateId_prType: {
            userId: 'user-1',
            exerciseTemplateId: 'exercise-1',
            prType: PrType.MAX_1RM_EST,
          },
        },
      }),
    );
    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          sessionId: expect.any(String),
        }),
        create: expect.objectContaining({
          sessionId: expect.any(String),
        }),
      }),
    );
    expect(prismaMock.pRRecord.deleteMany).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0]?.[0]).toHaveLength(4);
  });

  it('filters out sets from soft-deleted session exercises in recalculate query', async () => {
    const transaction = jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => []),
      },
      $transaction: transaction,
      pRRecord: {
        upsert: jest.fn(async () => undefined),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await service.recalculateForExercise('user-1', 'exercise-1');

    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: expect.objectContaining({
            exerciseTemplateId: 'exercise-1',
            deletedAt: null,
            session: {
              userId: 'user-1',
              deletedAt: null,
            },
          }),
        }),
      }),
    );
  });

  it('recalculate skips PR types that have no positive candidate', async () => {
    const transaction = jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 0,
            reps: 12,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
            sessionExercise: { sessionId: 'session-1' },
          },
        ]),
      },
      $transaction: transaction,
      pRRecord: {
        upsert: jest.fn(async () => undefined),
        deleteMany: jest.fn(async () => ({ count: 3 })),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await service.recalculateForExercise('user-1', 'exercise-1');

    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_exerciseTemplateId_prType: {
            userId: 'user-1',
            exerciseTemplateId: 'exercise-1',
            prType: PrType.MAX_REPS,
          },
        },
        update: expect.objectContaining({
          value: 12,
        }),
      }),
    );
    expect(prismaMock.pRRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        exerciseTemplateId: 'exercise-1',
        prType: {
          in: [PrType.MAX_WEIGHT, PrType.MAX_VOLUME, PrType.MAX_1RM_EST],
        },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('recalculate removes stale PRs when completed sets have no completion timestamp', async () => {
    const transaction = jest.fn(async (ops: Array<Promise<unknown>>) =>
      Promise.all(ops),
    );
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 120,
            reps: 6,
            completedAt: null,
            sessionExercise: { sessionId: 'session-1' },
          },
        ]),
      },
      $transaction: transaction,
      pRRecord: {
        upsert: jest.fn(async () => undefined),
        deleteMany: jest.fn(async () => ({ count: 4 })),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrDetectionService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(PrDetectionService);
    await service.recalculateForExercise('user-1', 'exercise-1');

    expect(prismaMock.pRRecord.upsert).not.toHaveBeenCalled();
    expect(prismaMock.pRRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        exerciseTemplateId: 'exercise-1',
        prType: {
          in: [
            PrType.MAX_WEIGHT,
            PrType.MAX_REPS,
            PrType.MAX_VOLUME,
            PrType.MAX_1RM_EST,
          ],
        },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0]?.[0]).toHaveLength(1);
  });
});
