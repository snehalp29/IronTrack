import type { PrismaService } from '../prisma/prisma.service';
import { VolumeService } from './volume.service';

describe('VolumeService', () => {
  const prismaMock = {
    set: { findMany: jest.fn() },
    workoutSession: { update: jest.fn() },
  } as unknown as PrismaService;

  const service = new VolumeService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates set volume by weight x reps', () => {
    expect(
      service.calculateSetVolume({
        weight: 80,
        reps: 8,
        durationSeconds: null,
      }),
    ).toBe(640);
  });

  it('calculates set volume by duration when weight/reps not present', () => {
    expect(
      service.calculateSetVolume({
        weight: null,
        reps: null,
        durationSeconds: 45,
      }),
    ).toBe(45);
  });

  it('returns zero set volume when no measurable load exists', () => {
    expect(
      service.calculateSetVolume({
        weight: null,
        reps: null,
        durationSeconds: null,
      }),
    ).toBe(0);
  });

  it('sums all completed set volumes for a session', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      { weight: 100, reps: 5, durationSeconds: null },
      { weight: null, reps: null, durationSeconds: 60 },
      { weight: null, reps: null, durationSeconds: null },
    ]);

    await expect(service.calculateSessionVolume('session-1')).resolves.toBe(
      560,
    );
  });

  it('caches computed volume on workout session', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      { weight: 50, reps: 10, durationSeconds: null },
    ]);
    (prismaMock.workoutSession.update as jest.Mock).mockResolvedValue({});

    await expect(service.cacheSessionVolume('session-1')).resolves.toBe(500);
    expect(prismaMock.workoutSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { totalVolume: 500 },
    });
  });
});
