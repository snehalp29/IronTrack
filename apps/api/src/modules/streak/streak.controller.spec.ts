import type { StreakService } from '../../services/streak.service';
import { StreakController } from './streak.controller';

describe('StreakController', () => {
  const streakServiceMock = {
    getWorkoutStreak: jest.fn(),
  } as unknown as StreakService;

  const controller = new StreakController(streakServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates workout streak lookup', async () => {
    (streakServiceMock.getWorkoutStreak as jest.Mock).mockResolvedValue({
      currentStreakDays: 7,
      longestStreakDays: 9,
      lastCompletedDate: '2026-03-06',
    });

    await expect(controller.workout({ sub: 'user-1' })).resolves.toEqual({
      currentStreakDays: 7,
      longestStreakDays: 9,
      lastCompletedDate: '2026-03-06',
    });
    expect(streakServiceMock.getWorkoutStreak).toHaveBeenCalledWith('user-1');
  });
});
