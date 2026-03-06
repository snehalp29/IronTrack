import type { Page, Route } from '@playwright/test';

const API_ORIGIN = 'http://localhost:3000';
const API_PREFIX = '/api/v1';

type WorkoutStreakResponse = {
  currentStreakDays: number;
  longestStreakDays: number;
  lastCompletedDate: string | null;
};

type SessionHistoryItem = {
  id: string;
  startedAt: string;
  durationSeconds: number | null;
  totalVolume: number | null;
  status?: 'IN_PROGRESS' | 'FINISHED';
  workoutTemplate?: {
    id: string;
    name: string;
  } | null;
};

type ActiveSession = ReturnType<typeof createActiveSession>;

type MockAuthOptions = {
  refreshStatus?: number;
  refreshErrorMessage?: string;
};

type MockApiDelays = {
  updateExerciseMs?: number;
  refreshMs?: number;
};

type MockApiOptions = {
  activeSession?: ActiveSession | null;
  sessions?: SessionHistoryItem[];
  workoutStreak?: WorkoutStreakResponse;
  auth?: MockAuthOptions;
  delays?: MockApiDelays;
};

export function createAccessToken(expiresInSeconds = 60 * 60): string {
  return [
    base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64UrlEncode(
      JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      }),
    ),
    'signature',
  ].join('.');
}

export async function seedAuthenticatedSession(
  page: Page,
  options?: {
    expiresInSeconds?: number;
  },
): Promise<void> {
  const accessToken = createAccessToken(options?.expiresInSeconds);
  await page.addInitScript((token: string) => {
    window.localStorage.setItem(
      'irontrack.auth.session',
      JSON.stringify({ accessToken: token }),
    );
  }, accessToken);
}

export async function mockApi(
  page: Page,
  options: MockApiOptions = {},
): Promise<void> {
  const state = {
    activeSession: options.activeSession ?? createActiveSession(),
    sessions: options.sessions ?? createSessionHistory(),
    workoutStreak: options.workoutStreak ?? createWorkoutStreak(),
    auth: options.auth ?? {},
    delays: options.delays ?? {},
  };

  await page.route(`${API_ORIGIN}${API_PREFIX}/**`, async (route) => {
    await handleApiRoute(route, state);
  });
}

async function handleApiRoute(
  route: Route,
  state: {
    activeSession: ActiveSession | null;
    sessions: SessionHistoryItem[];
    workoutStreak: WorkoutStreakResponse;
    auth: MockAuthOptions;
    delays: MockApiDelays;
  },
): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = `${url.pathname}${url.search}`;
  const method = request.method();

  if (path === '/api/v1/auth/login' && method === 'POST') {
    await fulfillJson(
      route,
      { accessToken: createAccessToken() },
      {
        'set-cookie':
          'irontrack_refresh_token=refresh-token-123; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
      },
    );
    return;
  }

  if (path === '/api/v1/auth/register' && method === 'POST') {
    await fulfillJson(
      route,
      { accessToken: createAccessToken() },
      {
        'set-cookie':
          'irontrack_refresh_token=refresh-token-123; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
      },
      201,
    );
    return;
  }

  if (path === '/api/v1/auth/logout' && method === 'POST') {
    await fulfillJson(
      route,
      { success: true },
      {
        'set-cookie':
          'irontrack_refresh_token=; Path=/api/v1/auth; Max-Age=0; HttpOnly; SameSite=Lax',
      },
    );
    return;
  }

  if (path === '/api/v1/auth/refresh' && method === 'POST') {
    if (state.delays.refreshMs) {
      await delay(state.delays.refreshMs);
    }

    if (state.auth.refreshStatus && state.auth.refreshStatus >= 400) {
      await route.fulfill({
        status: state.auth.refreshStatus,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: state.auth.refreshErrorMessage ?? 'Request failed',
          },
        }),
      });
      return;
    }

    await fulfillJson(route, { accessToken: createAccessToken() });
    return;
  }

  if (path === '/api/v1/users/me' && method === 'GET') {
    await fulfillJson(route, {
      id: 'user-1',
      email: 'demo@irontrack.local',
      name: 'Demo User',
      timezone: 'America/New_York',
      unitPreference: 'IMPERIAL',
      avatarUrl: null,
    });
    return;
  }

  if (path === '/api/v1/users/me' && method === 'PATCH') {
    const payload = request.postDataJSON() as {
      name?: string;
      timezone?: string;
      unitPreference?: 'METRIC' | 'IMPERIAL';
    };
    await fulfillJson(route, {
      id: 'user-1',
      email: 'demo@irontrack.local',
      name: payload.name ?? 'Demo User',
      timezone: payload.timezone ?? 'America/New_York',
      unitPreference: payload.unitPreference ?? 'IMPERIAL',
      avatarUrl: null,
    });
    return;
  }

  if (path === `/api/v1/checklist?date=${encodeURIComponent(todayDate())}`) {
    await fulfillJson(route, [
      {
        id: 'check-1',
        date: `${todayDate()}T00:00:00.000Z`,
        type: 'WORKOUT',
        isCompleted: true,
        completedAt: `${todayDate()}T10:00:00.000Z`,
      },
      {
        id: 'check-2',
        date: `${todayDate()}T00:00:00.000Z`,
        type: 'NOTES',
        isCompleted: false,
        completedAt: null,
      },
    ]);
    return;
  }

  if (path === '/api/v1/workout-templates' && method === 'GET') {
    await fulfillJson(route, [
      {
        id: 'template-1',
        name: 'Push Day A',
        description: 'Chest and shoulders',
        exercises: [
          {
            id: 'template-exercise-1',
            orderIndex: 0,
            defaultSets: 4,
            repMin: 8,
            repMax: 10,
            exercise: {
              id: 'exercise-bench',
              name: 'Bench Press',
            },
          },
        ],
        muscleCoverage: ['Chest', 'Shoulders'],
      },
    ]);
    return;
  }

  if (path === '/api/v1/workout-templates/template-1' && method === 'GET') {
    await fulfillJson(route, {
      id: 'template-1',
      name: 'Push Day A',
      description: 'Chest and shoulders',
      exercises: [
        {
          id: 'template-exercise-1',
          orderIndex: 0,
          defaultSets: 4,
          repMin: 8,
          repMax: 10,
          exercise: {
            id: 'exercise-bench',
            name: 'Bench Press',
          },
        },
        {
          id: 'template-exercise-2',
          orderIndex: 1,
          defaultSets: 3,
          repMin: 10,
          repMax: 12,
          exercise: {
            id: 'exercise-incline',
            name: 'Incline Press',
          },
        },
      ],
      muscleCoverage: ['Chest', 'Shoulders'],
    });
    return;
  }

  if (url.pathname === '/api/v1/sessions' && method === 'GET') {
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    const requestedPageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const status = url.searchParams.get('status');
    const filteredItems = status
      ? state.sessions.filter((item) => item.status === status)
      : state.sessions;
    const startIndex = (requestedPage - 1) * requestedPageSize;
    const items = filteredItems.slice(
      startIndex,
      startIndex + requestedPageSize,
    );

    await fulfillJson(route, {
      items,
      pagination: {
        page: requestedPage,
        pageSize: requestedPageSize,
        total: filteredItems.length,
      },
    });
    return;
  }

  if (path === '/api/v1/progress/weekly' && method === 'GET') {
    await fulfillJson(route, {
      weekStart: `${todayDate()}T00:00:00.000Z`,
      weekEnd: `${todayDate()}T23:59:59.999Z`,
      coveragePercent: 66,
      coveredMuscles: 4,
      totalMuscles: 6,
      perMuscleVolume: [
        { id: 'muscle-1', name: 'Chest', volume: 1200 },
        { id: 'muscle-2', name: 'Shoulders', volume: 800 },
      ],
    });
    return;
  }

  if (path === '/api/v1/streaks/workout' && method === 'GET') {
    await fulfillJson(route, state.workoutStreak);
    return;
  }

  if (path === '/api/v1/sessions/active' && method === 'GET') {
    await fulfillJson(route, state.activeSession);
    return;
  }

  if (path === '/api/v1/sessions' && method === 'POST') {
    state.activeSession = createActiveSession();
    await fulfillJson(route, state.activeSession);
    return;
  }

  if (path === '/api/v1/sessions/session-1/finish' && method === 'POST') {
    const finishedSession = state.activeSession ?? createActiveSession();
    state.activeSession = null;
    await fulfillJson(route, {
      ...finishedSession,
      totalVolume: 10240,
      newPrs: [],
      completion: {
        completedSets: 1,
        totalSets: 2,
        isIncomplete: true,
      },
      warning: 'Incomplete workout',
    });
    return;
  }

  if (
    path.startsWith('/api/v1/session-exercises/session-exercise-1/sets/') &&
    path.endsWith('/complete') &&
    method === 'PATCH'
  ) {
    const payload = request.postDataJSON() as { isCompleted: boolean };
    const setId = path.split('/')[6] ?? 'set-1';
    if (state.activeSession) {
      state.activeSession = {
        ...state.activeSession,
        sessionExercises: state.activeSession.sessionExercises.map(
          (exercise) =>
            exercise.id === 'session-exercise-1'
              ? {
                  ...exercise,
                  sets: exercise.sets.map((set) =>
                    set.id === setId
                      ? {
                          ...set,
                          isCompleted: payload.isCompleted,
                        }
                      : set,
                  ),
                }
              : exercise,
        ),
      };
    }
    await fulfillJson(route, {
      id: setId,
      orderIndex: setId === 'set-2' ? 1 : 0,
      reps: 8,
      weight: 100,
      durationSeconds: 0,
      isCompleted: payload.isCompleted,
    });
    return;
  }

  if (
    url.pathname.startsWith('/api/v1/sessions/session-1/exercises/') &&
    method === 'PATCH' &&
    !url.pathname.endsWith('/reorder') &&
    !url.pathname.endsWith('/superset')
  ) {
    if (state.delays.updateExerciseMs) {
      await delay(state.delays.updateExerciseMs);
    }

    const sessionExerciseId = url.pathname.split('/')[6];
    const payload = request.postDataJSON() as {
      notes?: string;
      supersetGroupKey?: string | null;
    };

    const sessionExercise = updateSessionExercise(
      state,
      sessionExerciseId,
      payload,
    );

    if (!sessionExercise) {
      await fulfillNotFound(route, method, path);
      return;
    }

    await fulfillJson(route, sessionExercise);
    return;
  }

  if (
    path === '/api/v1/sessions/session-1/exercises/superset' &&
    method === 'PATCH'
  ) {
    const payload = request.postDataJSON() as { exerciseIds?: string[] };
    const groupKey = payload.exerciseIds?.length ? 'superset-1' : null;

    if (state.activeSession) {
      state.activeSession = {
        ...state.activeSession,
        sessionExercises: state.activeSession.sessionExercises.map(
          (exercise) =>
            payload.exerciseIds?.includes(exercise.id)
              ? {
                  ...exercise,
                  supersetGroupKey: groupKey,
                }
              : {
                  ...exercise,
                  supersetGroupKey: null,
                },
        ),
      };
    }

    await fulfillJson(route, state.activeSession);
    return;
  }

  if (path === '/api/v1/exercises?page=1&pageSize=100' && method === 'GET') {
    await fulfillJson(route, {
      items: [
        {
          id: 'exercise-bench',
          name: 'Bench Press',
          exerciseType: 'WEIGHT_REPS',
          description: null,
          primaryMuscle: {
            id: 'muscle-1',
            name: 'Chest',
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 100,
        total: 1,
      },
    });
    return;
  }

  if (path === '/api/v1/muscle-groups' && method === 'GET') {
    await fulfillJson(route, [
      { id: 'muscle-1', name: 'Chest' },
      { id: 'muscle-2', name: 'Shoulders' },
    ]);
    return;
  }

  if (path === '/api/v1/equipment' && method === 'GET') {
    await fulfillJson(route, [
      { id: 'equipment-1', name: 'Barbell' },
      { id: 'equipment-2', name: 'Bench' },
    ]);
    return;
  }

  if (path === '/api/v1/exercises' && method === 'POST') {
    const payload = request.postDataJSON() as { name?: string };
    await fulfillJson(route, {
      id: 'exercise-created',
      name: payload.name ?? 'New Exercise',
    });
    return;
  }

  await fulfillNotFound(route, method, path);
}

export function createActiveSession(options?: {
  includeSecondExercise?: boolean;
}): {
  id: string;
  workoutTemplateId: string;
  startedAt: string;
  durationSeconds: number;
  totalVolume: number;
  status: string;
  sessionExercises: Array<{
    id: string;
    exerciseTemplateId: string;
    orderIndex: number;
    supersetGroupKey: string | null;
    notes: string | null;
    exercise: {
      id: string;
      name: string;
    };
    sets: Array<{
      id: string;
      orderIndex: number;
      reps: number;
      weight: number;
      durationSeconds: number;
      isCompleted: boolean;
    }>;
  }>;
} {
  const sessionExercises = [
    {
      id: 'session-exercise-1',
      exerciseTemplateId: 'exercise-bench',
      orderIndex: 0,
      supersetGroupKey: null,
      notes: null,
      exercise: {
        id: 'exercise-bench',
        name: 'Bench Press',
      },
      sets: [
        {
          id: 'set-1',
          orderIndex: 0,
          reps: 8,
          weight: 100,
          durationSeconds: 0,
          isCompleted: true,
        },
        {
          id: 'set-2',
          orderIndex: 1,
          reps: 8,
          weight: 100,
          durationSeconds: 0,
          isCompleted: false,
        },
      ],
    },
  ];

  if (options?.includeSecondExercise) {
    sessionExercises.push({
      id: 'session-exercise-2',
      exerciseTemplateId: 'exercise-row',
      orderIndex: 1,
      supersetGroupKey: null,
      notes: null,
      exercise: {
        id: 'exercise-row',
        name: 'Cable Row',
      },
      sets: [
        {
          id: 'set-3',
          orderIndex: 0,
          reps: 10,
          weight: 80,
          durationSeconds: 0,
          isCompleted: false,
        },
      ],
    });
  }

  return {
    id: 'session-1',
    workoutTemplateId: 'template-1',
    startedAt: `${todayDate()}T12:00:00.000Z`,
    durationSeconds: 900,
    totalVolume: 5120,
    status: 'ACTIVE',
    sessionExercises,
  };
}

async function fulfillJson(
  route: Route,
  payload: unknown,
  headers?: Record<string, string>,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(payload),
  });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createSessionHistory(): SessionHistoryItem[] {
  return [
    {
      id: 'session-previous',
      startedAt: `${todayDate()}T07:00:00.000Z`,
      durationSeconds: 1800,
      totalVolume: 10240,
      status: 'FINISHED',
      workoutTemplate: {
        id: 'template-1',
        name: 'Push Day A',
      },
    },
  ];
}

function createWorkoutStreak(): WorkoutStreakResponse {
  return {
    currentStreakDays: 3,
    longestStreakDays: 5,
    lastCompletedDate: todayDate(),
  };
}

async function fulfillNotFound(
  route: Route,
  method: string,
  path: string,
): Promise<void> {
  await route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({
      error: {
        message: `Unhandled API route: ${method} ${path}`,
      },
    }),
  });
}

function updateSessionExercise(
  state: {
    activeSession: ActiveSession | null;
  },
  sessionExerciseId: string,
  payload: {
    notes?: string;
    supersetGroupKey?: string | null;
  },
) {
  if (!state.activeSession) {
    return null;
  }

  let updatedExercise: ActiveSession['sessionExercises'][number] | null = null;
  state.activeSession = {
    ...state.activeSession,
    sessionExercises: state.activeSession.sessionExercises.map((exercise) => {
      if (exercise.id !== sessionExerciseId) {
        return exercise;
      }

      updatedExercise = {
        ...exercise,
        notes:
          payload.notes !== undefined
            ? payload.notes
            : (exercise.notes ?? null),
        supersetGroupKey:
          payload.supersetGroupKey !== undefined
            ? payload.supersetGroupKey
            : exercise.supersetGroupKey,
      };

      return updatedExercise;
    }),
  };

  return updatedExercise;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
