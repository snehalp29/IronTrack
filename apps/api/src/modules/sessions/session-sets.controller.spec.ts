import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { SessionSetsController } from './session-sets.controller';
import type { SessionsService } from './sessions.service';

describe('SessionSetsController', () => {
  const sessionsServiceMock = {
    createSet: jest.fn(),
    updateSet: jest.fn(),
    deleteSet: jest.fn(),
    toggleSetCompletion: jest.fn(),
    batchCreateSets: jest.fn(),
  } as unknown as SessionsService;

  const controller = new SessionSetsController(sessionsServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates createSet', async () => {
    const body = { orderIndex: 0, type: 'WEIGHT_REPS' as const, payload: {} };
    (sessionsServiceMock.createSet as jest.Mock).mockResolvedValue({
      id: 'set-1',
    });

    await expect(
      controller.createSet({ sub: 'u1' }, 'se1', body),
    ).resolves.toEqual({
      id: 'set-1',
    });
    expect(sessionsServiceMock.createSet).toHaveBeenCalledWith(
      'u1',
      'se1',
      body,
    );
  });

  it('delegates updateSet', async () => {
    const body = { orderIndex: 1 };
    (sessionsServiceMock.updateSet as jest.Mock).mockResolvedValue({
      id: 'set-1',
    });

    await expect(
      controller.updateSet({ sub: 'u1' }, 'se1', 'set-1', body),
    ).resolves.toEqual({ id: 'set-1' });
    expect(sessionsServiceMock.updateSet).toHaveBeenCalledWith(
      'u1',
      'se1',
      'set-1',
      body,
    );
  });

  it('delegates removeSet', async () => {
    (sessionsServiceMock.deleteSet as jest.Mock).mockResolvedValue({
      success: true,
    });

    await expect(
      controller.removeSet({ sub: 'u1' }, 'se1', 'set-1'),
    ).resolves.toBeUndefined();
    expect(sessionsServiceMock.deleteSet).toHaveBeenCalledWith(
      'u1',
      'se1',
      'set-1',
    );
  });

  it('marks removeSet as an HTTP 204 action', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        SessionSetsController.prototype.removeSet,
      ),
    ).toBe(204);
  });

  it('delegates completeSet', async () => {
    const body = { isCompleted: true };
    (sessionsServiceMock.toggleSetCompletion as jest.Mock).mockResolvedValue({
      id: 'set-1',
      isCompleted: true,
    });

    await expect(
      controller.completeSet({ sub: 'u1' }, 'se1', 'set-1', body),
    ).resolves.toEqual({ id: 'set-1', isCompleted: true });
    expect(sessionsServiceMock.toggleSetCompletion).toHaveBeenCalledWith(
      'u1',
      'se1',
      'set-1',
      body,
    );
  });

  it('delegates batchCreate', async () => {
    const body = {
      sets: [{ orderIndex: 0, type: 'WEIGHT_REPS' as const, payload: {} }],
    };
    (sessionsServiceMock.batchCreateSets as jest.Mock).mockResolvedValue([
      { id: 'set-1' },
    ]);

    await expect(
      controller.batchCreate({ sub: 'u1' }, 'se1', body),
    ).resolves.toEqual([{ id: 'set-1' }]);
    expect(sessionsServiceMock.batchCreateSets).toHaveBeenCalledWith(
      'u1',
      'se1',
      body,
    );
  });
});
