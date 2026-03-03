import { Test } from '@nestjs/testing';
import { PrType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PrDetectionService } from './pr-detection.service';

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
  });

  it('recalculates and upserts current PRs for one exercise', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 100,
            reps: 5,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
          },
          {
            id: 'set-2',
            weight: 0,
            reps: 10,
            completedAt: new Date('2024-01-02T10:00:00.000Z'),
          },
          {
            id: 'set-3',
            weight: 90,
            reps: 4,
            completedAt: null,
          },
        ]),
      },
      pRRecord: {
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
  });

  it('recalculate skips PR types that have no positive candidate', async () => {
    const prismaMock = {
      set: {
        findMany: jest.fn(async () => [
          {
            id: 'set-1',
            weight: 0,
            reps: 12,
            completedAt: new Date('2024-01-01T10:00:00.000Z'),
          },
        ]),
      },
      pRRecord: {
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
  });
});
