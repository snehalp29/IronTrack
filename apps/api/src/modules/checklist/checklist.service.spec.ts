import type { PrismaService } from '../../prisma/prisma.service';
import type { StreakService } from '../../services/streak.service';
import { ChecklistService } from './checklist.service';

describe('ChecklistService', () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  const createService = () => {
    const prismaMock = {
      checklistItem: {
        findMany: jest.fn(async () => []),
        upsert: jest.fn(async () => ({ id: 'item-1' })),
      },
    } as unknown as PrismaService;

    const streakServiceMock = {
      onChecklistCompleted: jest.fn(async () => undefined),
    } as unknown as StreakService;

    return {
      service: new ChecklistService(prismaMock, streakServiceMock),
      prismaMock,
      streakServiceMock,
    };
  };

  it('builds a 7-day UTC date range for weekly checklist queries across DST boundaries', async () => {
    process.env.TZ = 'America/New_York';

    const { service, prismaMock } = createService();

    await service.getWeek('user-1', { startDate: '2024-03-10' });

    expect(prismaMock.checklistItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2024-03-10T00:00:00.000Z'),
            lte: new Date('2024-03-16T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('loads checklist items by exact UTC date', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.checklistItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'item-1' },
    ]);

    await expect(service.getByDate('user-1', '2024-01-10')).resolves.toEqual([
      { id: 'item-1' },
    ]);
    expect(prismaMock.checklistItem.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        date: new Date('2024-01-10T00:00:00.000Z'),
      },
      orderBy: { type: 'asc' },
    });
  });

  it('upserts completed checklist item and records streak check', async () => {
    const { service, prismaMock, streakServiceMock } = createService();
    (prismaMock.checklistItem.upsert as jest.Mock).mockResolvedValue({
      id: 'item-1',
      userId: 'user-1',
      date: new Date('2024-01-10T00:00:00.000Z'),
      type: 'WORKOUT',
      isCompleted: true,
      completedAt: new Date('2024-01-10T10:00:00.000Z'),
      user: {
        timezone: 'America/New_York',
      },
    });

    await expect(
      service.upsert('user-1', {
        date: '2024-01-10',
        type: 'WORKOUT',
        isCompleted: true,
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'item-1' }));

    expect(prismaMock.checklistItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          userId: true,
          date: true,
          type: true,
          isCompleted: true,
          completedAt: true,
          user: {
            select: {
              timezone: true,
            },
          },
        },
        where: {
          userId_date_type: {
            userId: 'user-1',
            date: new Date('2024-01-10T00:00:00.000Z'),
            type: 'WORKOUT',
          },
        },
        update: {
          isCompleted: true,
          completedAt: expect.any(Date),
        },
        create: {
          userId: 'user-1',
          date: new Date('2024-01-10T00:00:00.000Z'),
          type: 'WORKOUT',
          isCompleted: true,
          completedAt: expect.any(Date),
        },
      }),
    );
    expect(streakServiceMock.onChecklistCompleted).toHaveBeenCalledWith(
      'user-1',
      '2024-01-10',
      'America/New_York',
    );
  });

  it('upserts incomplete checklist item with null completedAt', async () => {
    const { service, prismaMock, streakServiceMock } = createService();

    await service.upsert('user-1', {
      date: '2024-01-10',
      type: 'NOTES',
      isCompleted: false,
    });

    expect(prismaMock.checklistItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          isCompleted: false,
          completedAt: null,
        },
        create: expect.objectContaining({
          isCompleted: false,
          completedAt: null,
        }),
      }),
    );
    expect(streakServiceMock.onChecklistCompleted).not.toHaveBeenCalled();
  });

  it('forwards undefined timezone when checklist upsert has no related user timezone', async () => {
    const { service, prismaMock, streakServiceMock } = createService();
    (prismaMock.checklistItem.upsert as jest.Mock).mockResolvedValue({
      id: 'item-1',
      userId: 'user-1',
      date: new Date('2024-01-10T00:00:00.000Z'),
      type: 'WORKOUT',
      isCompleted: true,
      completedAt: new Date('2024-01-10T10:00:00.000Z'),
      user: null,
    });

    await service.upsert('user-1', {
      date: '2024-01-10',
      type: 'WORKOUT',
      isCompleted: true,
    });

    expect(streakServiceMock.onChecklistCompleted).toHaveBeenCalledWith(
      'user-1',
      '2024-01-10',
      undefined,
    );
  });
});
