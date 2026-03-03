import { ProgressController } from './progress.controller';
import type { ProgressService } from './progress.service';

describe('ProgressController', () => {
  it('delegates weekly query to service', async () => {
    const progressServiceMock = {
      weekly: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as ProgressService;

    const controller = new ProgressController(progressServiceMock);

    await expect(
      controller.weekly({ sub: 'user-1' }, { startDate: '2024-01-01' }),
    ).resolves.toEqual({ ok: true });

    expect(progressServiceMock.weekly).toHaveBeenCalledWith(
      'user-1',
      '2024-01-01',
    );
  });
});
