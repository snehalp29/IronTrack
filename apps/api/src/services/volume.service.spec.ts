import { calculateSetVolume } from '../common/utils/volume';
import type { PrismaService } from '../prisma/prisma.service';
import { VolumeService } from './volume.service';

describe('VolumeService', () => {
  const prismaMock = {
    set: { findMany: jest.fn() },
    workoutSession: { updateMany: jest.fn() },
  } as unknown as PrismaService;

  const service = new VolumeService(prismaMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates set volume by weight x reps', () => {
    expect(
      calculateSetVolume({ weight: 80, reps: 8, durationSeconds: null }),
    ).toBe(640);
  });

  it('returns zero set volume for duration-only sets', () => {
    expect(
      calculateSetVolume({
        weight: null,
        reps: null,
        durationSeconds: 45,
      }),
    ).toBe(0);
  });

  it('returns zero set volume when no measurable load exists', () => {
    expect(
      calculateSetVolume({
        weight: null,
        reps: null,
        durationSeconds: null,
      }),
    ).toBe(0);
  });

  it('keeps set-volume math in shared utility, not as a service method', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        Object.getPrototypeOf(service),
        'calculateSetVolume',
      ),
    ).toBe(false);
  });

  it('sums all completed set volumes for an active session only', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      { weight: 100, reps: 5, durationSeconds: null },
      { weight: null, reps: null, durationSeconds: 60 },
      { weight: null, reps: null, durationSeconds: null },
    ]);

    await expect(service.calculateSessionVolume('session-1')).resolves.toBe(
      500,
    );
    expect(prismaMock.set.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionExercise: {
            sessionId: 'session-1',
            deletedAt: null,
            session: {
              deletedAt: null,
            },
          },
        }),
      }),
    );
  });

  it('caches computed volume on workout session', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      { weight: 50, reps: 10, durationSeconds: null },
    ]);
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await expect(service.cacheSessionVolume('session-1')).resolves.toBe(500);
    expect(prismaMock.workoutSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', deletedAt: null },
      data: { totalVolume: 500 },
    });
  });

  it('returns computed volume even when no session rows are updated', async () => {
    (prismaMock.set.findMany as jest.Mock).mockResolvedValue([
      { weight: 40, reps: 8, durationSeconds: null },
    ]);
    (prismaMock.workoutSession.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(service.cacheSessionVolume('missing-session')).resolves.toBe(
      320,
    );
    expect(prismaMock.workoutSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing-session', deletedAt: null },
      data: { totalVolume: 320 },
    });
  });
});
