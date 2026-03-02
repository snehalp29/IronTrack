import type { PrismaService } from '../../prisma/prisma.service';
import type { StreakService } from '../../services/streak.service';
import { ChecklistService } from './checklist.service';

describe('ChecklistService', () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  it('builds a 7-day UTC date range for weekly checklist queries across DST boundaries', async () => {
    process.env.TZ = 'America/New_York';

    const prismaMock = {
      checklistItem: {
        findMany: jest.fn(async () => []),
      },
    } as unknown as PrismaService;
    const streakServiceMock = {} as StreakService;
    const service = new ChecklistService(prismaMock, streakServiceMock);

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
});
