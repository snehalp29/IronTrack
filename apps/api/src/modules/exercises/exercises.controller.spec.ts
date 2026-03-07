import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { ExercisesController } from './exercises.controller';
import type { ExercisesService } from './exercises.service';

describe('ExercisesController', () => {
  const exercisesServiceMock = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    history: jest.fn(),
    upsertNote: jest.fn(),
  } as unknown as ExercisesService;

  const controller = new ExercisesController(exercisesServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates list', async () => {
    const query = { page: 1, pageSize: 20 };
    (exercisesServiceMock.list as jest.Mock).mockResolvedValue([{ id: 'x1' }]);

    await expect(controller.list({ sub: 'user-1' }, query)).resolves.toEqual([
      { id: 'x1' },
    ]);
    expect(exercisesServiceMock.list).toHaveBeenCalledWith('user-1', query);
  });

  it('delegates getById', async () => {
    (exercisesServiceMock.getById as jest.Mock).mockResolvedValue({ id: 'x1' });

    await expect(controller.getById({ sub: 'user-1' }, 'x1')).resolves.toEqual({
      id: 'x1',
    });
    expect(exercisesServiceMock.getById).toHaveBeenCalledWith('user-1', 'x1');
  });

  it('delegates create', async () => {
    const body = {
      name: 'Squat',
      exerciseType: 'WEIGHT_REPS' as const,
      primaryMuscleGroupId: '11111111-1111-1111-1111-111111111111',
      secondaryMuscleGroupIds: [],
      equipmentIds: [],
    };
    (exercisesServiceMock.create as jest.Mock).mockResolvedValue({ id: 'x1' });

    await expect(controller.create({ sub: 'user-1' }, body)).resolves.toEqual({
      id: 'x1',
    });
    expect(exercisesServiceMock.create).toHaveBeenCalledWith('user-1', body);
  });

  it('delegates update', async () => {
    const body = { name: 'Updated' };
    (exercisesServiceMock.update as jest.Mock).mockResolvedValue({ id: 'x1' });

    await expect(
      controller.update({ sub: 'user-1' }, 'x1', body),
    ).resolves.toEqual({ id: 'x1' });
    expect(exercisesServiceMock.update).toHaveBeenCalledWith(
      'user-1',
      'x1',
      body,
    );
  });

  it('delegates remove', async () => {
    (exercisesServiceMock.softDelete as jest.Mock).mockResolvedValue({
      success: true,
    });

    await expect(
      controller.remove({ sub: 'user-1' }, 'x1'),
    ).resolves.toBeUndefined();
    expect(exercisesServiceMock.softDelete).toHaveBeenCalledWith(
      'user-1',
      'x1',
    );
  });

  it('marks remove as an HTTP 204 action', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        ExercisesController.prototype.remove,
      ),
    ).toBe(204);
  });

  it('delegates history', async () => {
    (exercisesServiceMock.history as jest.Mock).mockResolvedValue({
      items: [],
    });

    await expect(
      controller.history({ sub: 'user-1' }, 'x1', { page: 2, pageSize: 10 }),
    ).resolves.toEqual({ items: [] });
    expect(exercisesServiceMock.history).toHaveBeenCalledWith(
      'user-1',
      'x1',
      2,
      10,
    );
  });

  it('delegates upsertNote', async () => {
    const body = { note: 'great movement' };
    (exercisesServiceMock.upsertNote as jest.Mock).mockResolvedValue({
      id: 'note-1',
    });

    await expect(
      controller.upsertNote({ sub: 'user-1' }, 'x1', body),
    ).resolves.toEqual({ id: 'note-1' });
    expect(exercisesServiceMock.upsertNote).toHaveBeenCalledWith(
      'user-1',
      'x1',
      body,
    );
  });
});
