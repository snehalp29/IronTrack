import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import { WorkoutTemplatesService } from './workout-templates.service';

describe('WorkoutTemplatesService', () => {
  const createService = () => {
    const tx = {
      workoutTemplateExercise: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
        createMany: jest.fn(async () => ({ count: 1 })),
      },
      workoutTemplate: {
        update: jest.fn(async () => ({ id: 'template-1' })),
      },
    };

    const prismaMock = {
      workoutTemplate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      workoutTemplateExercise: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (client: typeof tx) => unknown)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    } as unknown as PrismaService;

    return {
      service: new WorkoutTemplatesService(prismaMock),
      prismaMock,
      tx,
    };
  };

  it('lists templates with nested exercise metadata', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findMany as jest.Mock).mockResolvedValue([
      { id: 't1' },
    ]);

    await expect(service.list('user-1')).resolves.toEqual([{ id: 't1' }]);
    expect(prismaMock.workoutTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', deletedAt: null } }),
    );
  });

  it('returns template by id with computed muscle coverage', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
      exercises: [
        {
          exercise: {
            primaryMuscle: { name: 'Chest' },
            secondaryMuscles: [
              { muscleGroup: { name: 'Triceps' } },
              { muscleGroup: { name: 'Shoulders' } },
            ],
          },
        },
        {
          exercise: {
            primaryMuscle: { name: 'Chest' },
            secondaryMuscles: [],
          },
        },
      ],
    });

    await expect(service.getById('user-1', 'template-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'template-1',
        muscleCoverage: ['Chest', 'Triceps', 'Shoulders'],
      }),
    );
  });

  it('throws when template is not found', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.getById('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates template and auto-assigns order index when omitted', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.count as jest.Mock).mockResolvedValue(3);
    (prismaMock.workoutTemplate.create as jest.Mock).mockResolvedValue({
      id: 't1',
    });

    await expect(
      service.create('user-1', {
        name: 'Pull Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
        ],
      }),
    ).resolves.toEqual({ id: 't1' });

    expect(prismaMock.workoutTemplate.count).toHaveBeenCalled();
    expect(prismaMock.workoutTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderIndex: 3,
        }),
      }),
    );
  });

  it('creates template with explicit order index', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.create as jest.Mock).mockResolvedValue({
      id: 't1',
    });

    await service.create('user-1', {
      name: 'Push Day',
      orderIndex: 8,
      exercises: [
        {
          exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
          orderIndex: 0,
        },
      ],
    });

    expect(prismaMock.workoutTemplate.count).not.toHaveBeenCalled();
    expect(prismaMock.workoutTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderIndex: 8 }),
      }),
    );
  });

  it('updates template and replaces exercises when provided', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });

    await expect(
      service.update('user-1', 'template-1', {
        name: 'Updated',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            defaultSets: 3,
          },
        ],
      }),
    ).resolves.toEqual({ id: 'template-1' });

    expect(tx.workoutTemplateExercise.deleteMany).toHaveBeenCalledWith({
      where: { workoutTemplateId: 'template-1' },
    });
    expect(tx.workoutTemplateExercise.createMany).toHaveBeenCalledWith({
      data: [
        {
          workoutTemplateId: 'template-1',
          exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
          orderIndex: 0,
          defaultSets: 3,
          repMin: undefined,
          repMax: undefined,
          supersetGroupKey: undefined,
        },
      ],
    });
    expect(tx.workoutTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template-1' },
      data: {
        name: 'Updated',
        description: undefined,
        orderIndex: undefined,
      },
    });
  });

  it('updates template metadata without replacing exercises when omitted', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });

    await service.update('user-1', 'template-1', {
      description: 'New description',
      orderIndex: 2,
    });

    expect(tx.workoutTemplateExercise.deleteMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplateExercise.createMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template-1' },
      data: {
        name: undefined,
        description: 'New description',
        orderIndex: 2,
      },
    });
  });

  it('throws forbidden when updating inaccessible template', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.update('user-1', 'template-1', { name: 'Denied' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft deletes template after ownership check', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (prismaMock.workoutTemplate.update as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });

    await expect(service.softDelete('user-1', 'template-1')).resolves.toEqual({
      success: true,
    });
    expect(prismaMock.workoutTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'template-1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('reorders templates in a transaction', async () => {
    const { service, prismaMock } = createService();

    await expect(
      service.reorder('user-1', {
        items: [{ id: 'template-1', orderIndex: 10 }],
      }),
    ).resolves.toEqual({ success: true });

    expect(prismaMock.workoutTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: 'template-1', userId: 'user-1', deletedAt: null },
      data: { orderIndex: 10 },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
