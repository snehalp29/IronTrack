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
});
