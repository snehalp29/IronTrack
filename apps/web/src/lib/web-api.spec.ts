import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteCurrentUser,
  fetchCurrentUser,
  fetchExerciseById,
  fetchExerciseHistory,
  fetchWorkoutTemplates,
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

  it('unwraps paginated workout-template responses into the items array', async () => {
    apiFetchMock.mockResolvedValue({
      items: [
        {
          id: 'template-1',
          name: 'Push Day',
          description: null,
          exercises: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 100,
        total: 1,
      },
    });

    await expect(fetchWorkoutTemplates()).resolves.toEqual([
      {
        id: 'template-1',
        name: 'Push Day',
        description: null,
        exercises: [],
      },
    ]);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/workout-templates',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
  });

  it('loads every workout-template page before returning the template pool', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        items: [
          {
            id: 'template-1',
            name: 'Push Day',
            description: null,
            exercises: [],
          },
        ],
        pagination: {
          page: 1,
          pageSize: 1,
          total: 2,
        },
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'template-2',
            name: 'Pull Day',
            description: null,
            exercises: [],
          },
        ],
        pagination: {
          page: 2,
          pageSize: 1,
          total: 2,
        },
      });

    await expect(fetchWorkoutTemplates()).resolves.toEqual([
      {
        id: 'template-1',
        name: 'Push Day',
        description: null,
        exercises: [],
      },
      {
        id: 'template-2',
        name: 'Pull Day',
        description: null,
        exercises: [],
      },
    ]);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/workout-templates',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/workout-templates?page=2&pageSize=1',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
  });

  it('fetches remaining exercise pages in parallel after the first page', async () => {
    let resolvePage2: ((value: unknown) => void) | undefined;
    let resolvePage3: ((value: unknown) => void) | undefined;
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/exercises?page=1&pageSize=100') {
        return Promise.resolve({
          items: [
            {
              id: 'exercise-1',
              name: 'Exercise 1',
              exerciseType: 'WEIGHT_REPS',
              description: null,
              primaryMuscle: null,
            },
          ],
          pagination: {
            page: 1,
            pageSize: 100,
            total: 250,
          },
        });
      }

      if (path === '/exercises?page=2&pageSize=100') {
        return new Promise((resolve) => {
          resolvePage2 = resolve;
        });
      }

      if (path === '/exercises?page=3&pageSize=100') {
        return new Promise((resolve) => {
          resolvePage3 = resolve;
        });
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const pendingPayload = listExercises();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      apiFetchMock.mock.calls.some(
        ([path]) => path === '/exercises?page=2&pageSize=100',
      ),
    ).toBe(true);
    expect(
      apiFetchMock.mock.calls.some(
        ([path]) => path === '/exercises?page=3&pageSize=100',
      ),
    ).toBe(true);

    resolvePage2?.({
      items: [
        {
          id: 'exercise-2',
          name: 'Exercise 2',
          exerciseType: 'WEIGHT_REPS',
          description: null,
          primaryMuscle: null,
        },
      ],
      pagination: {
        page: 2,
        pageSize: 100,
        total: 250,
      },
    });
    resolvePage3?.({
      items: [
        {
          id: 'exercise-3',
          name: 'Exercise 3',
          exerciseType: 'WEIGHT_REPS',
          description: null,
          primaryMuscle: null,
        },
      ],
      pagination: {
        page: 3,
        pageSize: 100,
        total: 250,
      },
    });

    await expect(pendingPayload).resolves.toEqual({
      items: [
        {
          id: 'exercise-1',
          name: 'Exercise 1',
          exerciseType: 'WEIGHT_REPS',
          description: null,
          primaryMuscle: null,
        },
        {
          id: 'exercise-2',
          name: 'Exercise 2',
          exerciseType: 'WEIGHT_REPS',
          description: null,
          primaryMuscle: null,
        },
        {
          id: 'exercise-3',
          name: 'Exercise 3',
          exerciseType: 'WEIGHT_REPS',
          description: null,
          primaryMuscle: null,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 100,
        total: 250,
      },
    });
  });

  it('loads every exercise-history page when no explicit pagination is requested', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
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
          page: 1,
          pageSize: 1,
          total: 2,
        },
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'set-2',
            reps: 10,
            weight: 105,
            durationSeconds: null,
            sessionExercise: {
              session: {
                id: 'session-2',
                startedAt: '2026-03-06T12:00:00.000Z',
                finishedAt: '2026-03-06T12:32:00.000Z',
              },
            },
          },
        ],
        pagination: {
          page: 2,
          pageSize: 1,
          total: 2,
        },
      });

    await expect(fetchExerciseHistory('exercise-bench')).resolves.toEqual({
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
        {
          id: 'set-2',
          reps: 10,
          weight: 105,
          durationSeconds: null,
          sessionExercise: {
            session: {
              id: 'session-2',
              startedAt: '2026-03-06T12:00:00.000Z',
              finishedAt: '2026-03-06T12:32:00.000Z',
            },
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        total: 2,
      },
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/exercises/exercise-bench/history',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/exercises/exercise-bench/history?page=2&pageSize=1',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
  });

  it('treats a successful account delete with no response body as success', async () => {
    apiFetchMock.mockResolvedValue(undefined);

    await expect(deleteCurrentUser()).resolves.toBeUndefined();
    expect(apiFetchMock).toHaveBeenCalledWith('/users/me', {
      method: 'DELETE',
    });
  });

  it('normalizes a null user timezone to UTC', async () => {
    apiFetchMock.mockResolvedValue({
      id: 'user-1',
      email: 'demo@irontrack.local',
      name: 'Demo User',
      timezone: null,
      unitPreference: 'METRIC',
      avatarUrl: null,
    });

    await expect(fetchCurrentUser()).resolves.toEqual(
      expect.objectContaining({
        id: 'user-1',
        timezone: 'UTC',
      }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/users/me',
      expect.objectContaining({
        schema: expect.any(Object),
      }),
    );
  });

  it('calls account delete without expecting a response payload schema', async () => {
    apiFetchMock.mockResolvedValue(undefined);

    await expect(deleteCurrentUser()).resolves.toBeUndefined();
    expect(apiFetchMock).toHaveBeenCalledWith('/users/me', {
      method: 'DELETE',
    });
  });
});
