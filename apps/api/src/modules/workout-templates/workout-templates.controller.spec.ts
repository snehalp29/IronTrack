import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { WorkoutTemplatesController } from './workout-templates.controller';
import type { WorkoutTemplatesService } from './workout-templates.service';

describe('WorkoutTemplatesController', () => {
  const workoutTemplatesServiceMock = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    reorder: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as WorkoutTemplatesService;

  const controller = new WorkoutTemplatesController(
    workoutTemplatesServiceMock,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates list', async () => {
    (workoutTemplatesServiceMock.list as jest.Mock).mockResolvedValue({
      items: [{ id: 'w1' }],
      pagination: { page: 1, pageSize: 100, total: 1 },
    });

    await expect(
      controller.list({ sub: 'u1' }, { page: 1, pageSize: 100 }),
    ).resolves.toEqual({
      items: [{ id: 'w1' }],
      pagination: { page: 1, pageSize: 100, total: 1 },
    });
    expect(workoutTemplatesServiceMock.list).toHaveBeenCalledWith('u1', {
      page: 1,
      pageSize: 100,
    });
  });

  it('delegates list with explicit pagination', async () => {
    (workoutTemplatesServiceMock.list as jest.Mock).mockResolvedValue({
      items: [{ id: 'w1' }],
      pagination: { page: 2, pageSize: 25, total: 40 },
    });

    await expect(
      controller.list({ sub: 'u1' }, { page: 2, pageSize: 25 }),
    ).resolves.toEqual({
      items: [{ id: 'w1' }],
      pagination: { page: 2, pageSize: 25, total: 40 },
    });
    expect(workoutTemplatesServiceMock.list).toHaveBeenCalledWith('u1', {
      page: 2,
      pageSize: 25,
    });
  });

  it('delegates getById', async () => {
    (workoutTemplatesServiceMock.getById as jest.Mock).mockResolvedValue({
      id: 'w1',
    });

    await expect(controller.getById({ sub: 'u1' }, 'w1')).resolves.toEqual({
      id: 'w1',
    });
    expect(workoutTemplatesServiceMock.getById).toHaveBeenCalledWith(
      'u1',
      'w1',
    );
  });

  it('delegates create', async () => {
    const body = {
      name: 'Push Day',
      exercises: [
        {
          exerciseTemplateId: '11111111-1111-1111-1111-111111111111',
          orderIndex: 0,
        },
      ],
    };
    (workoutTemplatesServiceMock.create as jest.Mock).mockResolvedValue({
      id: 'w1',
    });

    await expect(controller.create({ sub: 'u1' }, body)).resolves.toEqual({
      id: 'w1',
    });
    expect(workoutTemplatesServiceMock.create).toHaveBeenCalledWith('u1', body);
  });

  it('delegates reorder', async () => {
    const body = {
      items: [{ id: '11111111-1111-1111-1111-111111111111', orderIndex: 1 }],
    };
    (workoutTemplatesServiceMock.reorder as jest.Mock).mockResolvedValue({
      success: true,
    });

    await expect(controller.reorder({ sub: 'u1' }, body)).resolves.toEqual({
      success: true,
    });
    expect(workoutTemplatesServiceMock.reorder).toHaveBeenCalledWith(
      'u1',
      body,
    );
  });

  it('delegates update', async () => {
    const body = { name: 'New Name' };
    (workoutTemplatesServiceMock.update as jest.Mock).mockResolvedValue({
      id: 'w1',
    });

    await expect(controller.update({ sub: 'u1' }, 'w1', body)).resolves.toEqual(
      {
        id: 'w1',
      },
    );
    expect(workoutTemplatesServiceMock.update).toHaveBeenCalledWith(
      'u1',
      'w1',
      body,
    );
  });

  it('delegates remove', async () => {
    (workoutTemplatesServiceMock.softDelete as jest.Mock).mockResolvedValue({
      success: true,
    });

    await expect(controller.remove({ sub: 'u1' }, 'w1')).resolves.toEqual({
      success: true,
    });
    expect(workoutTemplatesServiceMock.softDelete).toHaveBeenCalledWith(
      'u1',
      'w1',
    );
  });

  it('marks remove as 204 No Content', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        WorkoutTemplatesController.prototype.remove,
      ),
    ).toBe(204);
  });
});
