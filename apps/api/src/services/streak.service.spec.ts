import { Test } from '@nestjs/testing';
import { ChecklistType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StreakService } from './streak.service';

describe('StreakService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates workout streak on first completion', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onSessionFinished('user-1');

    expect((prismaMock.userStreak.create as jest.Mock).mock.calls.length).toBe(
      1,
    );
  });

  it('treats duplicate streak creation as idempotent when concurrent insert occurs', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => {
          const error = new Error('Unique constraint failed') as Error & {
            code?: string;
            meta?: {
              target?: string[];
            };
          };
          error.code = 'P2002';
          error.meta = { target: ['userId', 'streakType'] };
          throw error;
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await expect(service.onSessionFinished('user-1')).resolves.toBeUndefined();
    expect(prismaMock.userStreak.updateMany).not.toHaveBeenCalled();
  });

  it('rethrows non-unique errors during initial streak creation', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => {
          const error = new Error('Unique constraint failed') as Error & {
            code?: string;
            meta?: {
              target?: string[];
            };
          };
          error.code = 'P2002';
          error.meta = { target: ['differentField'] };
          throw error;
        }),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await expect(service.onSessionFinished('user-1')).rejects.toThrow(
      'Unique constraint failed',
    );
  });

  it('rethrows non-P2002 errors during initial streak creation', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => {
          throw new Error('database unavailable');
        }),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await expect(service.onSessionFinished('user-1')).rejects.toThrow(
      'database unavailable',
    );
  });

  it('treats string-targeted streak unique constraint errors as idempotent', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => {
          const error = new Error('Unique constraint failed') as Error & {
            code?: string;
            meta?: {
              target?: string;
            };
          };
          error.code = 'P2002';
          error.meta = { target: 'UserStreak_userId_streakType_key' };
          throw error;
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await expect(service.onSessionFinished('user-1')).resolves.toBeUndefined();
  });

  it('rethrows P2002 errors when unique target metadata is missing', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => {
          const error = new Error('Unique constraint failed') as Error & {
            code?: string;
          };
          error.code = 'P2002';
          throw error;
        }),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await expect(service.onSessionFinished('user-1')).rejects.toThrow(
      'Unique constraint failed',
    );
  });

  it('rethrows non-object errors during initial streak creation', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => {
          throw 'boom';
        }),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await expect(service.onSessionFinished('user-1')).rejects.toBe('boom');
  });

  it('uses provided timezone without querying user profile', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService) as {
      onSessionFinished: (
        userId: string,
        completedAt?: Date,
        timezone?: string,
      ) => Promise<void>;
    };
    await service.onSessionFinished(
      'user-1',
      new Date('2024-01-31T23:30:00.000Z'),
      'UTC',
    );

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('normalizes provided timezone values before local-date calculation', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService) as {
      onSessionFinished: (
        userId: string,
        completedAt?: Date,
        timezone?: string,
      ) => Promise<void>;
    };
    await service.onSessionFinished(
      'user-1',
      new Date('2024-01-01T01:00:00.000Z'),
      ' America/Los_Angeles ',
    );

    expect(prismaMock.userStreak.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastCompletedDate: new Date('2023-12-31T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('falls back to user timezone when provided timezone is blank after trim', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'America/Los_Angeles',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService) as {
      onSessionFinished: (
        userId: string,
        completedAt?: Date,
        timezone?: string,
      ) => Promise<void>;
    };
    await service.onSessionFinished(
      'user-1',
      new Date('2024-01-01T01:00:00.000Z'),
      '   ',
    );

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(prismaMock.userStreak.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastCompletedDate: new Date('2023-12-31T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('uses the provided completion timestamp when finishing workout streak', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-01T12:00:00.000Z'));

    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService) as {
      onSessionFinished: (
        userId: string,
        completedAt?: Date,
        timezone?: string,
      ) => Promise<void>;
    };
    await service.onSessionFinished(
      'user-1',
      new Date('2024-01-31T23:30:00.000Z'),
    );

    expect(prismaMock.userStreak.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lastCompletedDate: new Date('2024-01-31T00:00:00.000Z'),
      }),
    });
  });

  it('counts completed checklist items with UTC-normalized date', async () => {
    const checklistFindMany = jest.fn(async () => []);
    const checklistCount = jest.fn(async () => 4);
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({ id: 'user-1', timezone: 'UTC' })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: {
        findMany: checklistFindMany,
        count: checklistCount,
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-02-03');

    expect(checklistCount).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        date: new Date('2024-02-03T00:00:00.000Z'),
        isCompleted: true,
        type: {
          in: [
            ChecklistType.WORKOUT,
            ChecklistType.WARMUP,
            ChecklistType.MOBILITY,
            ChecklistType.NOTES,
          ],
        },
      },
    });
    expect(checklistFindMany).not.toHaveBeenCalled();
  });

  it('does not increment when stored @db.Date matches checklist date in user timezone', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'America/Los_Angeles',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 4,
          longestStreakDays: 9,
          // Date-only DB field materializes as midnight UTC.
          lastCompletedDate: new Date('2024-01-02T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: {
        count: jest.fn(async () => 4),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-01-02');

    expect(
      (prismaMock.userStreak.updateMany as jest.Mock).mock.calls.length,
    ).toBe(0);
  });

  it('returns early when user no longer exists', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => null),
      },
      userStreak: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onSessionFinished('missing-user');

    expect(prismaMock.userStreak.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.userStreak.create).not.toHaveBeenCalled();
    expect(prismaMock.userStreak.updateMany).not.toHaveBeenCalled();
  });

  it('increments checklist streak on consecutive day completion', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'UTC',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 3,
          longestStreakDays: 5,
          lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: {
        count: jest.fn(async () => 4),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-01-02');

    expect(prismaMock.userStreak.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'streak-1',
        currentStreakDays: 3,
        longestStreakDays: 5,
        lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
      },
      data: {
        currentStreakDays: 4,
        longestStreakDays: 5,
        lastCompletedDate: new Date('2024-01-02T00:00:00.000Z'),
      },
    });
  });

  it('treats optimistic update conflicts as no-op when another writer wins', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'UTC',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 3,
          longestStreakDays: 5,
          lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      checklistItem: {
        count: jest.fn(async () => 4),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await expect(
      service.onChecklistCompleted('user-1', '2024-01-02'),
    ).resolves.toBeUndefined();
    expect(prismaMock.userStreak.updateMany).toHaveBeenCalledTimes(1);
  });

  it('updates longest streak when consecutive completion exceeds previous longest', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'UTC',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 4,
          longestStreakDays: 4,
          lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: {
        count: jest.fn(async () => 4),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-01-02');

    expect(prismaMock.userStreak.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'streak-1',
        currentStreakDays: 4,
        longestStreakDays: 4,
        lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
      },
      data: {
        currentStreakDays: 5,
        longestStreakDays: 5,
        lastCompletedDate: new Date('2024-01-02T00:00:00.000Z'),
      },
    });
  });

  it('resets checklist streak when completion is non-consecutive', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'Asia/Tokyo',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 5,
          longestStreakDays: 7,
          lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: {
        count: jest.fn(async () => 4),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-01-03');

    expect(prismaMock.userStreak.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'streak-1',
        currentStreakDays: 5,
        longestStreakDays: 7,
        lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
      },
      data: {
        currentStreakDays: 1,
        longestStreakDays: 7,
        lastCompletedDate: new Date('2024-01-03T00:00:00.000Z'),
      },
    });
  });

  it('resets checklist streak when provided completion date is before previous date', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'UTC',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 5,
          longestStreakDays: 7,
          lastCompletedDate: new Date('2024-01-03T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: {
        count: jest.fn(async () => 4),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-01-02');

    expect(prismaMock.userStreak.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'streak-1',
        currentStreakDays: 5,
        longestStreakDays: 7,
        lastCompletedDate: new Date('2024-01-03T00:00:00.000Z'),
      },
      data: {
        currentStreakDays: 1,
        longestStreakDays: 7,
        lastCompletedDate: new Date('2024-01-02T00:00:00.000Z'),
      },
    });
  });

  it('does not increment checklist streak when fewer than four items are completed', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      userStreak: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      checklistItem: {
        count: jest.fn(async () => 3),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-01-02');

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.userStreak.findUnique).not.toHaveBeenCalled();
  });

  it('increments checklist streak when completed count exceeds required checklist types', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'UTC',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: {
        count: jest.fn(async () => 5),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onChecklistCompleted('user-1', '2024-01-02');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(prismaMock.userStreak.create).toHaveBeenCalledTimes(1);
  });

  it('falls back to UTC when timezone value is invalid', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'Invalid/Timezone',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService) as {
      onSessionFinished: (
        userId: string,
        completedAt?: Date,
        timezone?: string,
      ) => Promise<void>;
    };
    await expect(
      service.onSessionFinished('user-1', new Date('2024-01-31T23:30:00.000Z')),
    ).resolves.toBeUndefined();

    expect(prismaMock.userStreak.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lastCompletedDate: new Date('2024-01-31T00:00:00.000Z'),
      }),
    });
  });

  it('uses UTC fallback timezone and resets streak when previous date is not consecutive', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: null,
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 8,
          longestStreakDays: 9,
          lastCompletedDate: null,
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onSessionFinished('user-1');

    expect(prismaMock.userStreak.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currentStreakDays: 8,
          longestStreakDays: 9,
          lastCompletedDate: null,
        }),
        data: expect.objectContaining({
          currentStreakDays: 1,
        }),
      }),
    );
  });

  it('does not update workout streak when completion falls on the same local day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-02T16:00:00.000Z'));

    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'America/Los_Angeles',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 6,
          longestStreakDays: 10,
          lastCompletedDate: new Date('2024-01-02T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onSessionFinished('user-1');

    expect(prismaMock.userStreak.updateMany).not.toHaveBeenCalled();
  });

  it('uses timezone-local day near UTC midnight for workout idempotency', async () => {
    // 2024-01-02T07:30Z is still 2024-01-01 in America/Los_Angeles.
    jest.useFakeTimers().setSystemTime(new Date('2024-01-02T07:30:00.000Z'));

    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          timezone: 'America/Los_Angeles',
        })),
      },
      userStreak: {
        findUnique: jest.fn(async () => ({
          id: 'streak-1',
          userId: 'user-1',
          currentStreakDays: 6,
          longestStreakDays: 10,
          lastCompletedDate: new Date('2024-01-01T00:00:00.000Z'),
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      checklistItem: { findMany: jest.fn(async () => []) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const service = moduleRef.get(StreakService);
    await service.onSessionFinished('user-1');

    expect(prismaMock.userStreak.updateMany).not.toHaveBeenCalled();
  });
});
