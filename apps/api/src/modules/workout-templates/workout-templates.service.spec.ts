import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

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
        create: jest.fn(async () => ({ id: 'template-1' })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findFirst: jest.fn(async () => ({ id: 'template-1' })),
      },
    };

    const prismaMock = {
      exerciseTemplate: {
        findMany: jest.fn(
          async (args?: {
            where?: {
              id?: {
                in?: string[];
              };
            };
          }) =>
            (args?.where?.id?.in ?? []).map((id) => ({
              id,
            })),
        ),
      },
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
      expect.objectContaining({
        where: { userId: 'user-1', deletedAt: null },
        include: {
          exercises: {
            where: {
              exercise: {
                deletedAt: null,
              },
            },
            orderBy: { orderIndex: 'asc' },
            include: {
              exercise: {
                include: {
                  primaryMuscle: true,
                  secondaryMuscles: { include: { muscleGroup: true } },
                },
              },
            },
          },
        },
      }),
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
    expect(prismaMock.workoutTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: 'template-1', userId: 'user-1', deletedAt: null },
      include: {
        exercises: {
          where: {
            exercise: {
              deletedAt: null,
            },
          },
          orderBy: { orderIndex: 'asc' },
          include: {
            exercise: {
              include: {
                primaryMuscle: true,
                secondaryMuscles: { include: { muscleGroup: true } },
              },
            },
          },
        },
      },
    });
  });

  it('throws when template is not found', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.getById('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates template and auto-assigns order index when omitted', async () => {
    const { service, prismaMock, tx } = createService();
    (tx.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      orderIndex: 2,
    });
    (tx.workoutTemplate.create as jest.Mock).mockResolvedValue({
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

    expect(prismaMock.workoutTemplate.count).not.toHaveBeenCalled();
    expect(tx.workoutTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderIndex: 3,
        }),
      }),
    );
  });

  it('derives default orderIndex from the highest active template order inside the transaction', async () => {
    const { service, prismaMock, tx } = createService();
    (tx.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      orderIndex: 7,
    });
    (tx.workoutTemplate.create as jest.Mock).mockResolvedValue({
      id: 't-serializable',
    });

    await expect(
      service.create('user-1', {
        name: 'Leg Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
        ],
      }),
    ).resolves.toEqual({ id: 't-serializable' });

    expect(prismaMock.workoutTemplate.count).not.toHaveBeenCalled();
    expect(tx.workoutTemplate.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', deletedAt: null },
      orderBy: [{ orderIndex: 'desc' }, { createdAt: 'desc' }],
      select: { orderIndex: true },
    });
    expect(tx.workoutTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderIndex: 8,
        }),
      }),
    );
  });

  it('creates template with explicit order index', async () => {
    const { service, prismaMock, tx } = createService();
    (tx.workoutTemplate.create as jest.Mock).mockResolvedValue({
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
    expect(tx.workoutTemplate.findFirst).not.toHaveBeenCalled();
    expect(tx.workoutTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderIndex: 8 }),
      }),
    );
  });

  it('trims template names before create persistence', async () => {
    const { service, tx } = createService();
    (tx.workoutTemplate.create as jest.Mock).mockResolvedValue({
      id: 't1',
    });

    await service.create('user-1', {
      name: '  Push Day  ',
      exercises: [
        {
          exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
          orderIndex: 0,
        },
      ],
    });

    expect(tx.workoutTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Push Day',
        }),
      }),
    );
  });

  it('rejects create when the trimmed template name is shorter than 2 characters', async () => {
    const { service, prismaMock } = createService();

    await expect(
      service.create('user-1', {
        name: '  a  ',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'TEMPLATE_NAME_INVALID',
      },
    });

    expect(prismaMock.workoutTemplate.create).not.toHaveBeenCalled();
  });

  it('throws forbidden when creating template with inaccessible exercises', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111' },
    ]);

    await expect(
      service.create('user-1', {
        name: 'Push Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.workoutTemplate.create).not.toHaveBeenCalled();
  });

  it('rejects template create when exercise order indexes are duplicated', async () => {
    const { service, prismaMock } = createService();

    await expect(
      service.create('user-1', {
        name: 'Push Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.workoutTemplate.create).not.toHaveBeenCalled();
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
    expect(tx.workoutTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: 'template-1', userId: 'user-1', deletedAt: null },
      data: {
        name: 'Updated',
        description: undefined,
        orderIndex: undefined,
        updatedAt: expect.any(Date),
      },
    });
    expect(tx.workoutTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: 'template-1', userId: 'user-1', deletedAt: null },
      include: {
        exercises: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  });

  it('returns refreshed template exercises after update', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (tx.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
      exercises: [
        {
          id: 'exercise-row-1',
          orderIndex: 0,
        },
      ],
    });

    await expect(
      service.update('user-1', 'template-1', {
        description: 'Refreshed',
      }),
    ).resolves.toEqual({
      id: 'template-1',
      exercises: [
        {
          id: 'exercise-row-1',
          orderIndex: 0,
        },
      ],
    });

    expect(tx.workoutTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: 'template-1', userId: 'user-1', deletedAt: null },
      include: {
        exercises: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  });

  it('trims template names before guarded update persistence', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });

    await service.update('user-1', 'template-1', {
      name: '  Updated  ',
    });

    expect(tx.workoutTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: 'template-1', userId: 'user-1', deletedAt: null },
      data: {
        name: 'Updated',
        description: undefined,
        orderIndex: undefined,
        updatedAt: expect.any(Date),
      },
    });
  });

  it('rejects update when the trimmed template name is shorter than 2 characters', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });

    await expect(
      service.update('user-1', 'template-1', { name: '  a  ' }),
    ).rejects.toMatchObject({
      response: {
        code: 'TEMPLATE_NAME_INVALID',
      },
    });

    expect(tx.workoutTemplate.updateMany).not.toHaveBeenCalled();
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
    expect(tx.workoutTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: 'template-1', userId: 'user-1', deletedAt: null },
      data: {
        name: undefined,
        description: 'New description',
        orderIndex: 2,
        updatedAt: expect.any(Date),
      },
    });
  });

  it('throws forbidden when updating template with inaccessible exercises', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111' },
    ]);

    await expect(
      service.update('user-1', 'template-1', {
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.workoutTemplateExercise.deleteMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplateExercise.createMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplate.updateMany).not.toHaveBeenCalled();
  });

  it('rejects template update when exercise order indexes are duplicated', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });

    await expect(
      service.update('user-1', 'template-1', {
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.workoutTemplateExercise.deleteMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplateExercise.createMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplate.updateMany).not.toHaveBeenCalled();
  });

  it('throws forbidden when template disappears before the guarded update write', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (tx.workoutTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.update('user-1', 'template-1', { name: 'Updated' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not rewrite template exercises when the guarded template update fails', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (tx.workoutTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.update('user-1', 'template-1', {
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.workoutTemplateExercise.deleteMany).not.toHaveBeenCalled();
    expect(tx.workoutTemplateExercise.createMany).not.toHaveBeenCalled();
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
    (prismaMock.workoutTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(service.softDelete('user-1', 'template-1')).resolves.toEqual({
      success: true,
    });
    expect(prismaMock.workoutTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'template-1', userId: 'user-1', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('throws forbidden when template disappears before the guarded soft delete write', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'template-1',
    });
    (prismaMock.workoutTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.softDelete('user-1', 'template-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reorders templates in a transaction', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.count as jest.Mock).mockResolvedValue(1);

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

  it('throws when reorder payload contains inaccessible templates', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.count as jest.Mock).mockResolvedValue(0);

    await expect(
      service.reorder('user-1', {
        items: [{ id: 'template-1', orderIndex: 10 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevalidates reorder ownership before applying updates', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.workoutTemplate.count as jest.Mock).mockResolvedValue(1);

    await expect(
      service.reorder('user-1', {
        items: [
          { id: 'template-1', orderIndex: 10 },
          { id: 'template-2', orderIndex: 11 },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.workoutTemplate.count).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['template-1', 'template-2'],
        },
        userId: 'user-1',
        deletedAt: null,
      },
    });
    expect(prismaMock.workoutTemplate.updateMany).not.toHaveBeenCalled();
  });
});
