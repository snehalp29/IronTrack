import type { PrismaService } from '../prisma/prisma.service';
import { CompletionService } from './completion.service';

describe('CompletionService', () => {
  const prismaMock = {
    set: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const service = new CompletionService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zero percent for sessions without sets', async () => {
    (prismaMock.set.count as jest.Mock)
      .mockReturnValueOnce('count-total')
      .mockReturnValueOnce('count-completed');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([0, 0]);

    await expect(service.calculate('session-1')).resolves.toEqual({
      totalSets: 0,
      completedSets: 0,
      completionPercent: 0,
      isIncomplete: false,
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'count-total',
      'count-completed',
    ]);
  });

  it('returns completion metrics for non-empty sessions', async () => {
    (prismaMock.set.count as jest.Mock)
      .mockReturnValueOnce('count-total')
      .mockReturnValueOnce('count-completed');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([8, 6]);

    await expect(service.calculate('session-2')).resolves.toEqual({
      totalSets: 8,
      completedSets: 6,
      completionPercent: 75,
      isIncomplete: true,
    });
  });

  it('returns complete metrics when all sets are completed', async () => {
    (prismaMock.set.count as jest.Mock)
      .mockReturnValueOnce('count-total')
      .mockReturnValueOnce('count-completed');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([5, 5]);

    await expect(service.calculate('session-3')).resolves.toEqual({
      totalSets: 5,
      completedSets: 5,
      completionPercent: 100,
      isIncomplete: false,
    });
  });

  it('rounds completion percent to two decimal places for non-even ratios', async () => {
    (prismaMock.set.count as jest.Mock)
      .mockReturnValueOnce('count-total')
      .mockReturnValueOnce('count-completed');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([3, 1]);

    await expect(service.calculate('session-4')).resolves.toEqual({
      totalSets: 3,
      completedSets: 1,
      completionPercent: 33.33,
      isIncomplete: true,
    });
  });

  it('excludes sets from soft-deleted session exercises in both count queries', async () => {
    (prismaMock.set.count as jest.Mock)
      .mockReturnValueOnce('count-total')
      .mockReturnValueOnce('count-completed');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([2, 1]);

    await service.calculate('session-5');

    expect(prismaMock.set.count).toHaveBeenNthCalledWith(1, {
      where: {
        deletedAt: null,
        sessionExercise: {
          sessionId: 'session-5',
          deletedAt: null,
        },
      },
    });
    expect(prismaMock.set.count).toHaveBeenNthCalledWith(2, {
      where: {
        deletedAt: null,
        isCompleted: true,
        sessionExercise: {
          sessionId: 'session-5',
          deletedAt: null,
        },
      },
    });
  });
});
