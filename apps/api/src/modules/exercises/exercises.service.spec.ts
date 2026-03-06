import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import { ExercisesService } from './exercises.service';

describe('ExercisesService', () => {
  const createService = () => {
    const tx = {
      exerciseTemplate: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        findFirst: jest.fn(async () => ({ id: 'exercise-1' })),
      },
      pRRecord: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      exerciseTemplateSecondaryMuscle: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
        createMany: jest.fn(async () => ({ count: 1 })),
      },
      exerciseTemplateEquipment: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
        createMany: jest.fn(async () => ({ count: 1 })),
      },
    };

    const prismaMock = {
      exerciseTemplate: {
        findFirst: jest.fn(async () => ({ id: 'exercise-1' })),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      pRRecord: {
        deleteMany: jest.fn(),
      },
      set: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      exerciseNote: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (client: typeof tx) => unknown)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    } as unknown as PrismaService;

    return {
      service: new ExercisesService(prismaMock),
      prismaMock,
      tx,
    };
  };

  it('returns paginated list and query filters', async () => {
    const { service, prismaMock } = createService();

    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([
      { id: 'exercise-1', name: 'Bench Press' },
    ]);
    (prismaMock.exerciseTemplate.count as jest.Mock).mockResolvedValue(1);

    const response = await service.list('user-1', {
      page: 2,
      pageSize: 10,
      isGlobal: true,
      muscleGroup: 'chest',
      equipment: 'barbell',
      type: 'WEIGHT_REPS',
      search: 'bench',
    });

    expect(response.pagination).toEqual({ page: 2, pageSize: 10, total: 1 });
    expect(response.items).toHaveLength(1);

    expect(prismaMock.exerciseTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          exerciseType: 'WEIGHT_REPS',
          isGlobal: true,
          OR: [{ isGlobal: true }, { ownerUserId: 'user-1' }],
          name: { contains: 'bench', mode: 'insensitive' },
          primaryMuscle: {
            name: { equals: 'chest', mode: 'insensitive' },
          },
          equipment: {
            some: {
              equipment: {
                name: { equals: 'barbell', mode: 'insensitive' },
              },
            },
          },
        }),
      }),
    );
  });

  it('trims list query search, muscle, and equipment filters before querying', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.exerciseTemplate.count as jest.Mock).mockResolvedValue(0);

    await service.list('user-1', {
      page: 1,
      pageSize: 20,
      isGlobal: undefined,
      muscleGroup: '  chest  ',
      equipment: '  barbell  ',
      type: undefined,
      search: '  bench  ',
    });

    expect(prismaMock.exerciseTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'bench', mode: 'insensitive' },
          primaryMuscle: {
            name: { equals: 'chest', mode: 'insensitive' },
          },
          equipment: {
            some: {
              equipment: {
                name: { equals: 'barbell', mode: 'insensitive' },
              },
            },
          },
        }),
      }),
    );
  });

  it('returns list without optional filter clauses when query fields are missing', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.exerciseTemplate.count as jest.Mock).mockResolvedValue(0);

    await service.list('user-1', {
      page: 1,
      pageSize: 20,
      isGlobal: undefined,
      muscleGroup: undefined,
      equipment: undefined,
      type: undefined,
      search: undefined,
    });

    expect(prismaMock.exerciseTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          exerciseType: undefined,
          isGlobal: undefined,
          name: undefined,
          primaryMuscle: undefined,
          equipment: undefined,
        }),
      }),
    );
  });

  it('gets exercise details by id', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });

    await expect(service.getById('user-1', 'exercise-1')).resolves.toEqual({
      id: 'exercise-1',
    });
  });

  it('throws when exercise is missing', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(service.getById('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates exercise when name is unique for owner', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce(
      null,
    );
    (prismaMock.exerciseTemplate.create as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });

    await expect(
      service.create('user-1', {
        name: 'Custom Curl',
        exerciseType: 'WEIGHT_REPS',
        primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
        secondaryMuscleGroupIds: ['22222222-2222-4222-8222-222222222222'],
        equipmentIds: ['33333333-3333-4333-8333-333333333333'],
      }),
    ).resolves.toEqual({ id: 'exercise-1' });

    expect(prismaMock.exerciseTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'user-1',
          isGlobal: false,
          secondaryMuscles: {
            create: [{ muscleGroupId: '22222222-2222-4222-8222-222222222222' }],
          },
          equipment: {
            create: [{ equipmentId: '33333333-3333-4333-8333-333333333333' }],
          },
        }),
      }),
    );
  });

  it('trims exercise name before create uniqueness check and persistence', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce(
      null,
    );
    (prismaMock.exerciseTemplate.create as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });

    await service.create('user-1', {
      name: '  Custom Curl  ',
      exerciseType: 'WEIGHT_REPS',
      primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
      secondaryMuscleGroupIds: [],
      equipmentIds: [],
    });

    expect(prismaMock.exerciseTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        ownerUserId: 'user-1',
        deletedAt: null,
        id: undefined,
        name: {
          equals: 'Custom Curl',
          mode: 'insensitive',
        },
      },
    });
    expect(prismaMock.exerciseTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Custom Curl',
        }),
      }),
    );
  });

  it('rejects create when the trimmed exercise name is shorter than 2 characters', async () => {
    const { service, prismaMock } = createService();

    await expect(
      service.create('user-1', {
        name: '  a  ',
        exerciseType: 'WEIGHT_REPS',
        primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
        secondaryMuscleGroupIds: [],
        equipmentIds: [],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EXERCISE_NAME_INVALID',
      },
    });

    expect(prismaMock.exerciseTemplate.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.exerciseTemplate.create).not.toHaveBeenCalled();
  });

  it('deduplicates secondary muscle ids when creating an exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce(
      null,
    );
    (prismaMock.exerciseTemplate.create as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });

    await service.create('user-1', {
      name: 'Dedup Secondary',
      exerciseType: 'WEIGHT_REPS',
      primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
      secondaryMuscleGroupIds: [
        '22222222-2222-4222-8222-222222222222',
        '22222222-2222-4222-8222-222222222222',
      ],
      equipmentIds: [],
    });

    expect(prismaMock.exerciseTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          secondaryMuscles: {
            create: [
              {
                muscleGroupId: '22222222-2222-4222-8222-222222222222',
              },
            ],
          },
        }),
      }),
    );
  });

  it('deduplicates equipment ids when creating an exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce(
      null,
    );
    (prismaMock.exerciseTemplate.create as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });

    await service.create('user-1', {
      name: 'Dedup Equipment',
      exerciseType: 'WEIGHT_REPS',
      primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
      secondaryMuscleGroupIds: [],
      equipmentIds: [
        '33333333-3333-4333-8333-333333333333',
        '33333333-3333-4333-8333-333333333333',
      ],
    });

    expect(prismaMock.exerciseTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          equipment: {
            create: [
              {
                equipmentId: '33333333-3333-4333-8333-333333333333',
              },
            ],
          },
        }),
      }),
    );
  });

  it('rejects create when duplicate custom name exists', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'existing',
    });

    await expect(
      service.create('user-1', {
        name: 'Duplicate',
        exerciseType: 'WEIGHT_REPS',
        primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
        secondaryMuscleGroupIds: [],
        equipmentIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps concurrent create name races to EXERCISE_NAME_EXISTS', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce(
      null,
    );
    (prismaMock.exerciseTemplate.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['name'],
      },
    });

    await expect(
      service.create('user-1', {
        name: 'Duplicate',
        exerciseType: 'WEIGHT_REPS',
        primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
        secondaryMuscleGroupIds: [],
        equipmentIds: [],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EXERCISE_NAME_EXISTS',
      },
    });
  });

  it('updates editable custom exercise and replaces relation rows', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'exercise-1',
        name: 'Old Name',
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.update('user-1', 'exercise-1', {
        name: 'New Name',
        secondaryMuscleGroupIds: ['22222222-2222-4222-8222-222222222222'],
        equipmentIds: ['33333333-3333-4333-8333-333333333333'],
      }),
    ).resolves.toEqual({ id: 'exercise-1' });

    expect(tx.exerciseTemplateSecondaryMuscle.deleteMany).toHaveBeenCalledWith({
      where: { exerciseTemplateId: 'exercise-1' },
    });
    expect(tx.exerciseTemplateSecondaryMuscle.createMany).toHaveBeenCalledWith({
      data: [
        {
          exerciseTemplateId: 'exercise-1',
          muscleGroupId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    });
    expect(tx.exerciseTemplateEquipment.deleteMany).toHaveBeenCalledWith({
      where: { exerciseTemplateId: 'exercise-1' },
    });
    expect(tx.exerciseTemplateEquipment.createMany).toHaveBeenCalledWith({
      data: [
        {
          exerciseTemplateId: 'exercise-1',
          equipmentId: '33333333-3333-4333-8333-333333333333',
        },
      ],
    });
    expect(tx.exerciseTemplate.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'exercise-1',
        ownerUserId: 'user-1',
        isGlobal: false,
        deletedAt: null,
      },
      data: {
        name: 'New Name',
        description: undefined,
        exerciseType: undefined,
        primaryMuscleGroupId: undefined,
        defaultSets: undefined,
        repMin: undefined,
        repMax: undefined,
        defaultCues: undefined,
        updatedAt: expect.any(Date),
      },
    });
    expect(tx.exerciseTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'exercise-1',
        ownerUserId: 'user-1',
        isGlobal: false,
        deletedAt: null,
      },
    });
  });

  it('trims renamed exercise names before uniqueness check and persistence', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'exercise-1',
        name: 'Old Name',
      })
      .mockResolvedValueOnce(null);

    await service.update('user-1', 'exercise-1', {
      name: '  New Name  ',
    });

    expect(prismaMock.exerciseTemplate.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        ownerUserId: 'user-1',
        deletedAt: null,
        id: { not: 'exercise-1' },
        name: {
          equals: 'New Name',
          mode: 'insensitive',
        },
      },
    });
    expect(tx.exerciseTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'exercise-1',
          ownerUserId: 'user-1',
          isGlobal: false,
          deletedAt: null,
        },
        data: expect.objectContaining({
          name: 'New Name',
        }),
      }),
    );
  });

  it('rejects update when the trimmed exercise name is shorter than 2 characters', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'exercise-1',
      name: 'Current',
    });

    await expect(
      service.update('user-1', 'exercise-1', { name: '  a  ' }),
    ).rejects.toMatchObject({
      response: {
        code: 'EXERCISE_NAME_INVALID',
      },
    });

    expect(tx.exerciseTemplate.updateMany).not.toHaveBeenCalled();
  });

  it('deduplicates secondary muscle ids when updating an exercise', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'exercise-1',
      name: 'Current',
    });

    await service.update('user-1', 'exercise-1', {
      secondaryMuscleGroupIds: [
        '22222222-2222-4222-8222-222222222222',
        '22222222-2222-4222-8222-222222222222',
      ],
    });

    expect(tx.exerciseTemplateSecondaryMuscle.createMany).toHaveBeenCalledWith({
      data: [
        {
          exerciseTemplateId: 'exercise-1',
          muscleGroupId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    });
  });

  it('deduplicates equipment ids when updating an exercise', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'exercise-1',
      name: 'Current',
    });

    await service.update('user-1', 'exercise-1', {
      equipmentIds: [
        '33333333-3333-4333-8333-333333333333',
        '33333333-3333-4333-8333-333333333333',
      ],
    });

    expect(tx.exerciseTemplateEquipment.createMany).toHaveBeenCalledWith({
      data: [
        {
          exerciseTemplateId: 'exercise-1',
          equipmentId: '33333333-3333-4333-8333-333333333333',
        },
      ],
    });
  });

  it('updates without relation inserts when empty arrays provided', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'exercise-1',
      name: 'Current',
    });

    await service.update('user-1', 'exercise-1', {
      secondaryMuscleGroupIds: [],
      equipmentIds: [],
    });

    expect(tx.exerciseTemplateSecondaryMuscle.deleteMany).toHaveBeenCalled();
    expect(
      tx.exerciseTemplateSecondaryMuscle.createMany,
    ).not.toHaveBeenCalled();
    expect(tx.exerciseTemplateEquipment.deleteMany).toHaveBeenCalled();
    expect(tx.exerciseTemplateEquipment.createMany).not.toHaveBeenCalled();
  });

  it('updates metadata without touching relation tables when arrays are omitted', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'exercise-1',
      name: 'Current',
    });

    await service.update('user-1', 'exercise-1', {
      description: 'Updated',
    });

    expect(
      tx.exerciseTemplateSecondaryMuscle.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      tx.exerciseTemplateSecondaryMuscle.createMany,
    ).not.toHaveBeenCalled();
    expect(tx.exerciseTemplateEquipment.deleteMany).not.toHaveBeenCalled();
    expect(tx.exerciseTemplateEquipment.createMany).not.toHaveBeenCalled();
    expect(tx.exerciseTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'exercise-1',
          ownerUserId: 'user-1',
          isGlobal: false,
          deletedAt: null,
        },
        data: expect.objectContaining({
          description: 'Updated',
        }),
      }),
    );
  });

  it('blocks update for non-editable exercises', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(
      service.update('user-1', 'exercise-1', { name: 'Denied' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats soft-deleted custom exercises as non-editable', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(
      service.update('user-1', 'exercise-1', { name: 'Denied' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.exerciseTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'exercise-1',
        ownerUserId: 'user-1',
        isGlobal: false,
        deletedAt: null,
      },
    });
  });

  it('throws when exercise disappears before the guarded update write', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'exercise-1',
      name: 'Current',
    });
    (tx.exerciseTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.update('user-1', 'exercise-1', { description: 'Updated' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not rewrite relation rows when the guarded exercise update fails', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'exercise-1',
      name: 'Current',
    });
    (tx.exerciseTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.update('user-1', 'exercise-1', {
        secondaryMuscleGroupIds: ['22222222-2222-4222-8222-222222222222'],
        equipmentIds: ['33333333-3333-4333-8333-333333333333'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      tx.exerciseTemplateSecondaryMuscle.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      tx.exerciseTemplateSecondaryMuscle.createMany,
    ).not.toHaveBeenCalled();
    expect(tx.exerciseTemplateEquipment.deleteMany).not.toHaveBeenCalled();
    expect(tx.exerciseTemplateEquipment.createMany).not.toHaveBeenCalled();
  });

  it('maps concurrent rename races to EXERCISE_NAME_EXISTS', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'exercise-1',
        name: 'Current',
      })
      .mockResolvedValueOnce(null);
    (tx.exerciseTemplate.updateMany as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['name'],
      },
    });

    await expect(
      service.update('user-1', 'exercise-1', { name: 'Duplicate' }),
    ).rejects.toMatchObject({
      response: {
        code: 'EXERCISE_NAME_EXISTS',
      },
    });
  });

  it('blocks update when renamed to existing owner name', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'exercise-1', name: 'Current Name' })
      .mockResolvedValueOnce({ id: 'exercise-2' });

    await expect(
      service.update('user-1', 'exercise-1', { name: 'Duplicate Name' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft deletes user-owned custom exercise', async () => {
    const { service, prismaMock, tx } = createService();
    (prismaMock.exerciseTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(service.softDelete('user-1', 'exercise-1')).resolves.toEqual({
      success: true,
    });
    expect(tx.exerciseTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'exercise-1',
          ownerUserId: 'user-1',
          isGlobal: false,
          deletedAt: null,
        },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(tx.pRRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        exerciseTemplateId: 'exercise-1',
      },
    });
  });

  it('rejects soft delete for inaccessible exercise', async () => {
    const { service, tx } = createService();
    (tx.exerciseTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.softDelete('user-1', 'exercise-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns paginated exercise history from active session rows only', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findMany as jest.Mock).mockReturnValueOnce(
      'history-find-many',
    );
    (prismaMock.set.count as jest.Mock).mockReturnValueOnce('history-count');
    (prismaMock.$transaction as jest.Mock).mockResolvedValue([
      [{ id: 'set-1' }],
      5,
    ]);

    await expect(
      service.history('user-1', 'exercise-1', 2, 3),
    ).resolves.toEqual({
      items: [{ id: 'set-1' }],
      pagination: { page: 2, pageSize: 3, total: 5 },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'history-find-many',
      'history-count',
    ]);
    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          sessionExercise: {
            exerciseTemplateId: 'exercise-1',
            deletedAt: null,
            exercise: {
              deletedAt: null,
            },
            session: {
              userId: 'user-1',
              deletedAt: null,
            },
          },
        },
        orderBy: [
          {
            completedAt: {
              sort: 'desc',
              nulls: 'last',
            },
          },
          { createdAt: 'desc' },
        ],
        skip: 3,
        take: 3,
      }),
    );
    expect(prismaMock.set.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        sessionExercise: {
          exerciseTemplateId: 'exercise-1',
          deletedAt: null,
          exercise: {
            deletedAt: null,
          },
          session: {
            userId: 'user-1',
            deletedAt: null,
          },
        },
      },
    });
  });

  it('rejects exercise history lookups for inaccessible exercises before querying sets', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(
      service.history('user-1', 'exercise-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.set.findMany).not.toHaveBeenCalled();
    expect(prismaMock.set.count).not.toHaveBeenCalled();
  });

  it('uses default history pagination arguments when page and pageSize are omitted', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.set.count as jest.Mock).mockResolvedValue(0);

    await expect(service.history('user-1', 'exercise-1')).resolves.toEqual({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    });
    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('upserts exercise note after ownership/access check', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });
    (prismaMock.exerciseNote.upsert as jest.Mock).mockResolvedValue({
      id: 'note-1',
    });

    await expect(
      service.upsertNote('user-1', 'exercise-1', { note: 'Keep elbows in' }),
    ).resolves.toEqual({ id: 'note-1' });

    expect(prismaMock.exerciseNote.upsert).toHaveBeenCalledWith({
      where: {
        userId_exerciseTemplateId: {
          userId: 'user-1',
          exerciseTemplateId: 'exercise-1',
        },
      },
      update: { note: 'Keep elbows in' },
      create: {
        userId: 'user-1',
        exerciseTemplateId: 'exercise-1',
        note: 'Keep elbows in',
      },
    });
  });

  it('trims exercise notes before upsert', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });
    (prismaMock.exerciseNote.upsert as jest.Mock).mockResolvedValue({
      id: 'note-1',
    });

    await service.upsertNote('user-1', 'exercise-1', {
      note: '  Keep elbows in  ',
    });

    expect(prismaMock.exerciseNote.upsert).toHaveBeenCalledWith({
      where: {
        userId_exerciseTemplateId: {
          userId: 'user-1',
          exerciseTemplateId: 'exercise-1',
        },
      },
      update: { note: 'Keep elbows in' },
      create: {
        userId: 'user-1',
        exerciseTemplateId: 'exercise-1',
        note: 'Keep elbows in',
      },
    });
  });

  it('rejects blank exercise notes after trimming', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'exercise-1',
    });

    await expect(
      service.upsertNote('user-1', 'exercise-1', {
        note: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.exerciseNote.upsert).not.toHaveBeenCalled();
  });
});
