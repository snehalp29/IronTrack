import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { StreakService } from './streak.service';

describe('StreakService', () => {
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
        update: jest.fn(async ({ data }) => data),
      },
      checklistItem: {
        findMany: jest.fn(async () =>
          Array.from({ length: 4 }, (_, index) => ({
            id: `item-${index}`,
            userId: 'user-1',
            date: new Date('2024-01-02T00:00:00.000Z'),
            isCompleted: true,
          })),
        ),
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

    expect((prismaMock.userStreak.update as jest.Mock).mock.calls.length).toBe(
      0,
    );
  });
});
