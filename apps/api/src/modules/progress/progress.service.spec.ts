import type { PrismaService } from '../../prisma/prisma.service';
import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  const prismaMock = {
    set: { findMany: jest.fn() },
    muscleGroup: { count: jest.fn() },
  } as unknown as PrismaService;

  const service = new ProgressService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aggregates weekly per-muscle volume and coverage', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      {
        weight: 100,
        reps: 5,
        durationSeconds: null,
        sessionExercise: {
          exercise: {
            primaryMuscle: { id: 'm1', name: 'Chest' },
            secondaryMuscles: [
              { muscleGroup: { id: 'm2', name: 'Triceps' } },
              { muscleGroup: { id: 'm3', name: 'Shoulders' } },
            ],
          },
        },
      },
      {
        weight: null,
        reps: null,
        durationSeconds: 60,
        sessionExercise: {
          exercise: {
            primaryMuscle: { id: 'm2', name: 'Triceps' },
            secondaryMuscles: [],
          },
        },
      },
    ]);
    (prismaMock.muscleGroup.count as jest.Mock).mockResolvedValue(6);

    const result = await service.weekly('user-1', '2024-01-01');

    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            session: {
              userId: 'user-1',
              startedAt: {
                gte: new Date('2024-01-01T00:00:00.000Z'),
                lt: new Date('2024-01-08T00:00:00.000Z'),
              },
            },
          },
        }),
      }),
    );
    expect(result.weekStart).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    expect(result.weekEnd).toEqual(new Date('2024-01-07T23:59:59.999Z'));
    expect(result.coveredMuscles).toBe(3);
    expect(result.totalMuscles).toBe(6);
    expect(result.coveragePercent).toBe(50);
    expect(result.perMuscleVolume).toEqual([
      { id: 'm1', name: 'Chest', volume: 500 },
      { id: 'm2', name: 'Triceps', volume: 310 },
      { id: 'm3', name: 'Shoulders', volume: 250 },
    ]);
  });

  it('ignores secondary muscles that duplicate primary or repeat within a set', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      {
        weight: 100,
        reps: 5,
        durationSeconds: null,
        sessionExercise: {
          exercise: {
            primaryMuscle: { id: 'm1', name: 'Chest' },
            secondaryMuscles: [
              { muscleGroup: { id: 'm1', name: 'Chest' } },
              { muscleGroup: { id: 'm2', name: 'Triceps' } },
              { muscleGroup: { id: 'm2', name: 'Triceps' } },
            ],
          },
        },
      },
    ]);
    (prismaMock.muscleGroup.count as jest.Mock).mockResolvedValue(6);

    const result = await service.weekly('user-1', '2024-01-01');

    expect(result.coveredMuscles).toBe(2);
    expect(result.perMuscleVolume).toEqual([
      { id: 'm1', name: 'Chest', volume: 500 },
      { id: 'm2', name: 'Triceps', volume: 250 },
    ]);
  });

  it('uses weight x reps when both load data and duration are present', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      {
        weight: 100,
        reps: 5,
        durationSeconds: 60,
        sessionExercise: {
          exercise: {
            primaryMuscle: { id: 'm1', name: 'Chest' },
            secondaryMuscles: [],
          },
        },
      },
    ]);
    (prismaMock.muscleGroup.count as jest.Mock).mockResolvedValue(1);

    const result = await service.weekly('user-1', '2024-01-01');

    expect(result.perMuscleVolume).toEqual([
      { id: 'm1', name: 'Chest', volume: 500 },
    ]);
  });

  it('returns zero volume when set has no usable load or duration', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      {
        weight: 100,
        reps: null,
        durationSeconds: null,
        sessionExercise: {
          exercise: {
            primaryMuscle: { id: 'm1', name: 'Chest' },
            secondaryMuscles: [],
          },
        },
      },
    ]);
    (prismaMock.muscleGroup.count as jest.Mock).mockResolvedValue(1);

    const result = await service.weekly('user-1', '2024-01-01');

    expect(result.perMuscleVolume).toEqual([
      { id: 'm1', name: 'Chest', volume: 0 },
    ]);
  });

  it('uses startOfWeek when no explicit startDate is provided', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-10T12:00:00.000Z'));

    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.muscleGroup.count as jest.Mock).mockResolvedValue(0);

    const result = await service.weekly('user-1');

    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            session: {
              userId: 'user-1',
              startedAt: {
                gte: new Date('2024-03-04T00:00:00.000Z'),
                lt: new Date('2024-03-11T00:00:00.000Z'),
              },
            },
          },
        }),
      }),
    );
    expect(result.coveragePercent).toBe(0);
  });

  it('keeps Monday as the week start when today is already Monday', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-11T12:00:00.000Z'));

    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.muscleGroup.count as jest.Mock).mockResolvedValue(0);

    await service.weekly('user-1');

    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            session: {
              userId: 'user-1',
              startedAt: {
                gte: new Date('2024-03-11T00:00:00.000Z'),
                lt: new Date('2024-03-18T00:00:00.000Z'),
              },
            },
          },
        }),
      }),
    );
  });

  it('normalizes provided startDate to the Monday of that week', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.muscleGroup.count as jest.Mock).mockResolvedValue(0);

    await service.weekly('user-1', '2024-03-13');

    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            session: {
              userId: 'user-1',
              startedAt: {
                gte: new Date('2024-03-11T00:00:00.000Z'),
                lt: new Date('2024-03-18T00:00:00.000Z'),
              },
            },
          },
        }),
      }),
    );
  });

  it('rejects invalid startDate values when service is called directly', async () => {
    await expect(service.weekly('user-1', 'not-a-date')).rejects.toThrow(
      'Invalid startDate',
    );
  });
});
