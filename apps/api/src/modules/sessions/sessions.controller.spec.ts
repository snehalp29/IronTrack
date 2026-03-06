import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { SessionsController } from './sessions.controller';
import type { SessionsService } from './sessions.service';

describe('SessionsController', () => {
  const sessionsServiceMock = {
    startSession: jest.fn(),
    getActiveSession: jest.fn(),
    getSession: jest.fn(),
    updateSession: jest.fn(),
    finishSession: jest.fn(),
    listSessions: jest.fn(),
    softDeleteSession: jest.fn(),
    addSessionExercise: jest.fn(),
    updateSessionExercise: jest.fn(),
    deleteSessionExercise: jest.fn(),
    reorderSessionExercises: jest.fn(),
    swapSessionExercise: jest.fn(),
    applySessionSuperset: jest.fn(),
  } as unknown as SessionsService;

  const controller = new SessionsController(sessionsServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates start', async () => {
    const body = { exercises: [] };
    (sessionsServiceMock.startSession as jest.Mock).mockResolvedValue({
      id: 's1',
    });

    await expect(controller.start({ sub: 'u1' }, body)).resolves.toEqual({
      id: 's1',
    });
    expect(sessionsServiceMock.startSession).toHaveBeenCalledWith('u1', body);
  });

  it('delegates active', async () => {
    (sessionsServiceMock.getActiveSession as jest.Mock).mockResolvedValue({
      id: 's1',
    });

    await expect(controller.active({ sub: 'u1' })).resolves.toEqual({
      id: 's1',
    });
    expect(sessionsServiceMock.getActiveSession).toHaveBeenCalledWith('u1');
  });

  it('delegates getById', async () => {
    (sessionsServiceMock.getSession as jest.Mock).mockResolvedValue({
      id: 's1',
    });

    await expect(controller.getById({ sub: 'u1' }, 's1')).resolves.toEqual({
      id: 's1',
    });
    expect(sessionsServiceMock.getSession).toHaveBeenCalledWith('u1', 's1');
  });

  it('delegates update', async () => {
    const body = { version: 1 };
    (sessionsServiceMock.updateSession as jest.Mock).mockResolvedValue({
      id: 's1',
    });

    await expect(controller.update({ sub: 'u1' }, 's1', body)).resolves.toEqual(
      {
        id: 's1',
      },
    );
    expect(sessionsServiceMock.updateSession).toHaveBeenCalledWith(
      'u1',
      's1',
      body,
    );
  });

  it('delegates finish', async () => {
    (sessionsServiceMock.finishSession as jest.Mock).mockResolvedValue({
      id: 's1',
    });

    await expect(controller.finish({ sub: 'u1' }, 's1')).resolves.toEqual({
      id: 's1',
    });
    expect(sessionsServiceMock.finishSession).toHaveBeenCalledWith('u1', 's1');
  });

  it('marks finish as an HTTP 200 action', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        SessionsController.prototype.finish,
      ),
    ).toBe(200);
  });

  it('delegates list', async () => {
    const query = { page: 1, pageSize: 20 };
    (sessionsServiceMock.listSessions as jest.Mock).mockResolvedValue({
      items: [],
    });

    await expect(controller.list({ sub: 'u1' }, query)).resolves.toEqual({
      items: [],
    });
    expect(sessionsServiceMock.listSessions).toHaveBeenCalledWith('u1', query);
  });

  it('delegates remove', async () => {
    (sessionsServiceMock.softDeleteSession as jest.Mock).mockResolvedValue({
      success: true,
    });

    await expect(
      controller.remove({ sub: 'u1' }, 's1'),
    ).resolves.toBeUndefined();
    expect(sessionsServiceMock.softDeleteSession).toHaveBeenCalledWith(
      'u1',
      's1',
    );
  });

  it('marks remove as an HTTP 204 action', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        SessionsController.prototype.remove,
      ),
    ).toBe(204);
  });

  it('delegates addExercise', async () => {
    const body = {
      exerciseTemplateId: '11111111-1111-1111-1111-111111111111',
      orderIndex: 0,
    };
    (sessionsServiceMock.addSessionExercise as jest.Mock).mockResolvedValue({
      id: 'se1',
    });

    await expect(
      controller.addExercise({ sub: 'u1' }, 's1', body),
    ).resolves.toEqual({
      id: 'se1',
    });
    expect(sessionsServiceMock.addSessionExercise).toHaveBeenCalledWith(
      'u1',
      's1',
      body,
    );
  });

  it('delegates updateExercise', async () => {
    const body = { orderIndex: 1 };
    (sessionsServiceMock.updateSessionExercise as jest.Mock).mockResolvedValue({
      id: 'se1',
    });

    await expect(
      controller.updateExercise({ sub: 'u1' }, 's1', 'se1', body),
    ).resolves.toEqual({ id: 'se1' });
    expect(sessionsServiceMock.updateSessionExercise).toHaveBeenCalledWith(
      'u1',
      's1',
      'se1',
      body,
    );
  });

  it('delegates removeExercise', async () => {
    (sessionsServiceMock.deleteSessionExercise as jest.Mock).mockResolvedValue({
      success: true,
    });

    await expect(
      controller.removeExercise({ sub: 'u1' }, 's1', 'se1'),
    ).resolves.toEqual({
      success: true,
    });
    expect(sessionsServiceMock.deleteSessionExercise).toHaveBeenCalledWith(
      'u1',
      's1',
      'se1',
    );
  });

  it('delegates reorderExercises', async () => {
    const body = {
      items: [{ id: '11111111-1111-1111-1111-111111111111', orderIndex: 0 }],
    };
    (
      sessionsServiceMock.reorderSessionExercises as jest.Mock
    ).mockResolvedValue({ ok: true });

    await expect(
      controller.reorderExercises({ sub: 'u1' }, 's1', body),
    ).resolves.toEqual({ ok: true });
    expect(sessionsServiceMock.reorderSessionExercises).toHaveBeenCalledWith(
      'u1',
      's1',
      body,
    );
  });

  it('delegates swapExercise', async () => {
    const body = {
      fromExerciseId: '11111111-1111-1111-1111-111111111111',
      toExerciseTemplateId: '22222222-2222-2222-2222-222222222222',
    };
    (sessionsServiceMock.swapSessionExercise as jest.Mock).mockResolvedValue({
      ok: true,
    });

    await expect(
      controller.swapExercise({ sub: 'u1' }, 's1', body),
    ).resolves.toEqual({
      ok: true,
    });
    expect(sessionsServiceMock.swapSessionExercise).toHaveBeenCalledWith(
      'u1',
      's1',
      body,
    );
  });

  it('delegates applySuperset', async () => {
    const body = {
      exerciseIds: [
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
      ],
    };
    (sessionsServiceMock.applySessionSuperset as jest.Mock).mockResolvedValue({
      id: 's1',
    });

    await expect(
      controller.applySuperset({ sub: 'u1' }, 's1', body),
    ).resolves.toEqual({
      id: 's1',
    });
    expect(sessionsServiceMock.applySessionSuperset).toHaveBeenCalledWith(
      'u1',
      's1',
      body,
    );
  });
});
