import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchExerciseById,
  fetchExerciseHistory,
  listExercises,
} from './web-api';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  apiFetch: apiFetchMock,
}));

describe('web-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads all exercise pages instead of stopping at the first 100 rows', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) => ({
          id: `exercise-${index + 1}`,
          name: `Exercise ${index + 1}`,
          exerciseType: 'WEIGHT_REPS',
          description: null,
          primaryMuscle: null,
        })),
        pagination: {
          page: 1,
          pageSize: 100,
          total: 101,
        },
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'exercise-101',
            name: 'Exercise 101',
            exerciseType: 'WEIGHT_REPS',
            description: null,
            primaryMuscle: null,
          },
        ],
        pagination: {
          page: 2,
          pageSize: 100,
          total: 101,
        },
      });

    const payload = await listExercises();

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/exercises?page=1&pageSize=100',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/exercises?page=2&pageSize=100',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
    expect(payload.items).toHaveLength(101);
    expect(payload.pagination.total).toBe(101);
  });

  it('fetches exercise detail payloads through the detail endpoint', async () => {
    apiFetchMock.mockResolvedValue({
      id: 'exercise-bench',
      name: 'Bench Press',
      description: 'Press strongly',
      exerciseType: 'WEIGHT_REPS',
      primaryMuscle: {
        id: 'muscle-1',
        name: 'Chest',
      },
      secondaryMuscles: [],
      equipment: [],
      defaultSets: 4,
      repMin: 6,
      repMax: 8,
      defaultCues: 'Keep wrists stacked',
      notes: [],
    });

    await expect(fetchExerciseById('exercise-bench')).resolves.toEqual(
      expect.objectContaining({
        id: 'exercise-bench',
        name: 'Bench Press',
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/exercises/exercise-bench',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
  });

  it('fetches paginated exercise history payloads', async () => {
    apiFetchMock.mockResolvedValue({
      items: [
        {
          id: 'set-1',
          reps: 8,
          weight: 100,
          durationSeconds: null,
          sessionExercise: {
            session: {
              id: 'session-1',
              startedAt: '2026-03-05T12:00:00.000Z',
              finishedAt: '2026-03-05T12:30:00.000Z',
            },
          },
        },
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        total: 25,
      },
    });

    await expect(
      fetchExerciseHistory('exercise-bench', {
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        pagination: expect.objectContaining({
          page: 2,
          pageSize: 10,
          total: 25,
        }),
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/exercises/exercise-bench/history?page=2&pageSize=10',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
  });
});
