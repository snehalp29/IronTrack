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
        update: jest.fn(async () => ({ id: 'exercise-1' })),
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
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
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
    expect(tx.exerciseTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
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
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(service.softDelete('user-1', 'exercise-1')).resolves.toEqual({
      success: true,
    });
    expect(prismaMock.exerciseTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exercise-1', ownerUserId: 'user-1', isGlobal: false },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects soft delete for inaccessible exercise', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.exerciseTemplate.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      service.softDelete('user-1', 'exercise-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns paginated exercise history', async () => {
    const { service, prismaMock } = createService();
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([{ id: 'set-1' }]);
    (prismaMock.set.count as jest.Mock).mockResolvedValue(5);

    await expect(
      service.history('user-1', 'exercise-1', 2, 3),
    ).resolves.toEqual({
      items: [{ id: 'set-1' }],
      pagination: { page: 2, pageSize: 3, total: 5 },
    });
    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 3, take: 3 }),
    );
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
});
