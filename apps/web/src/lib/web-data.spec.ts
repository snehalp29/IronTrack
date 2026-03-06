import type { FormEvent } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeWorkoutStreakDays,
  getTodayDate,
  useActiveWorkoutPageData,
  useCompletionFlowData,
  useDashboardPageData,
  useExerciseDetailPageData,
  useExerciseSelectPageData,
  useExerciseWizardPageData,
  useHistoryPageData,
  useSettingsPageData,
  useTemplateBuilderPageData,
  useWorkoutPreviewPageData,
} from './web-data';

const useStateMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useMemoMock = vi.hoisted(() =>
  vi.fn((factory: () => unknown) => factory()),
);
const navigateMock = vi.hoisted(() => vi.fn());
const useNavigateMock = vi.hoisted(() => vi.fn(() => navigateMock));
const useParamsMock = vi.hoisted(() => vi.fn(() => ({ id: 'exercise-bench' })));
const useSearchParamsMock = vi.hoisted(() =>
  vi.fn(() => [new URLSearchParams(), vi.fn()]),
);
const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn());
const useQueryClientMock = vi.hoisted(() => vi.fn());
const logoutCurrentSessionMock = vi.hoisted(() => vi.fn());
const clearAuthSessionMock = vi.hoisted(() => vi.fn());
const deleteCurrentUserMock = vi.hoisted(() => vi.fn());
const createWorkoutTemplateMock = vi.hoisted(() => vi.fn());
const listWorkoutSessionsMock = vi.hoisted(() => vi.fn());
const fetchWorkoutStreakMock = vi.hoisted(() => vi.fn());
const fetchActiveSessionMock = vi.hoisted(() => vi.fn());
const finishWorkoutSessionMock = vi.hoisted(() => vi.fn());
const toggleWorkoutSetCompletionMock = vi.hoisted(() => vi.fn());
const swapWorkoutExerciseMock = vi.hoisted(() => vi.fn());
const updateWorkoutExerciseMock = vi.hoisted(() => vi.fn());
const applyWorkoutSupersetMock = vi.hoisted(() => vi.fn());
const useRestTimerMock = vi.hoisted(() => vi.fn());
const useActiveWorkoutStoreMock = vi.hoisted(() => vi.fn());
const initialWizardFormValues = {
  name: '',
  description: '',
  exerciseType: 'WEIGHT_REPS',
  primaryMuscleGroupId: '',
  secondaryMuscleGroupIds: [] as string[],
  equipmentIds: [] as string[],
  defaultSets: '',
  repMin: '',
  repMax: '',
  defaultCues: '',
};

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: useEffectMock,
    useMemo: useMemoMock,
    useState: useStateMock,
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: useNavigateMock,
  useParams: useParamsMock,
  useSearchParams: useSearchParamsMock,
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
  useQueryClient: useQueryClientMock,
}));

vi.mock('../auth/auth-service', () => ({
  logoutCurrentSession: logoutCurrentSessionMock,
}));

vi.mock('../auth/auth-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/auth-session')>();
  return {
    ...actual,
    clearAuthSession: clearAuthSessionMock,
  };
});

vi.mock('../hooks/useRestTimer', () => ({
  useRestTimer: useRestTimerMock,
}));

vi.mock('../stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: useActiveWorkoutStoreMock,
}));

vi.mock('./web-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./web-api')>();
  return {
    ...actual,
    createWorkoutTemplate: createWorkoutTemplateMock,
    deleteCurrentUser: deleteCurrentUserMock,
    fetchActiveSession: fetchActiveSessionMock,
    fetchWorkoutStreak: fetchWorkoutStreakMock,
    finishWorkoutSession: finishWorkoutSessionMock,
    listWorkoutSessions: listWorkoutSessionsMock,
    swapWorkoutExercise: swapWorkoutExerciseMock,
    toggleWorkoutSetCompletion: toggleWorkoutSetCompletionMock,
    updateWorkoutExercise: updateWorkoutExerciseMock,
    applyWorkoutSuperset: applyWorkoutSupersetMock,
  };
});

describe('web-data', () => {
  const queryClient = {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    useEffectMock.mockImplementation(() => undefined);
    useQueryClientMock.mockReturnValue(queryClient);
  });

  it('deduplicates checklist date calculation with the user timezone on dashboard', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-03-07T04:30:00.000Z'));

    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'user') {
        return {
          data: {
            timezone: 'America/New_York',
          },
          error: undefined,
          isLoading: false,
        };
      }

      if (queryKey[0] === 'checklist') {
        return {
          data: [],
          error: undefined,
          isLoading: false,
        };
      }

      if (queryKey[0] === 'templates') {
        return {
          data: [],
          error: undefined,
          isLoading: false,
        };
      }

      return {
        data: {
          items: [],
        },
        error: undefined,
        isLoading: false,
      };
    });

    useDashboardPageData();

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['checklist', '2026-03-06'],
      }),
    );
  });

  it('computes today using the provided timezone instead of UTC', () => {
    expect(
      getTodayDate('America/New_York', new Date('2026-03-07T04:30:00.000Z')),
    ).toBe('2026-03-06');
  });

  it('falls back to UTC when the provided timezone is invalid', () => {
    expect(
      getTodayDate('Mars/Olympus', new Date('2026-03-07T04:30:00.000Z')),
    ).toBe('2026-03-07');
  });

  it('treats two UTC-separated sessions on the same local day as one streak day', () => {
    expect(
      computeWorkoutStreakDays(
        [
          { startedAt: '2026-03-06T03:30:00.000Z' },
          { startedAt: '2026-03-05T15:00:00.000Z' },
        ],
        'America/New_York',
      ),
    ).toBe(1);
  });

  it('swallows rejected settings saves after the mutation reports the error', async () => {
    const preventDefault = vi.fn();
    const setErrorMessage = vi.fn();
    useStateMock
      .mockReturnValueOnce(['Name', vi.fn()])
      .mockReturnValueOnce(['UTC', vi.fn()])
      .mockReturnValueOnce(['METRIC', vi.fn()])
      .mockReturnValueOnce(['90', vi.fn()])
      .mockReturnValueOnce([undefined, setErrorMessage]);
    useQueryMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    useMutationMock.mockImplementation(
      ({ onError }: { onError?: (error: unknown) => void }) => ({
        error: undefined,
        isPending: false,
        mutateAsync: vi.fn(async () => {
          const error = new Error('Save failed');
          onError?.(error);
          throw error;
        }),
      }),
    );

    const data = useSettingsPageData();

    await expect(
      data.onSave({
        preventDefault,
      } as unknown as FormEvent),
    ).resolves.toBeUndefined();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(setErrorMessage).toHaveBeenCalledWith('Save failed');
  });

  it('marks settings as dirty when the local form diverges from the saved profile', () => {
    useStateMock
      .mockReturnValueOnce(['Updated Name', vi.fn()])
      .mockReturnValueOnce(['America/New_York', vi.fn()])
      .mockReturnValueOnce(['IMPERIAL', vi.fn()])
      .mockReturnValueOnce(['120', vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()]);
    useQueryMock.mockReturnValue({
      data: {
        name: 'Iron Lifter',
        timezone: 'UTC',
        unitPreference: 'METRIC',
      },
      error: undefined,
      isLoading: false,
    });
    useMutationMock.mockReturnValue({
      error: undefined,
      isPending: false,
      mutateAsync: vi.fn(),
    });

    const data = useSettingsPageData();

    expect(data.isDirty).toBe(true);
  });

  it('requests only finished sessions for history data and formats dates in the user timezone', async () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'user') {
        return {
          data: {
            timezone: 'America/New_York',
          },
          error: undefined,
          isLoading: false,
        };
      }

      return {
        data: {
          items: [
            {
              id: 'session-1',
              startedAt: '2026-03-06T03:30:00.000Z',
              durationSeconds: 600,
              totalVolume: 1234,
              status: 'FINISHED',
              workoutTemplate: null,
            },
          ],
          pagination: { page: 1, pageSize: 20, total: 1 },
        },
        error: undefined,
        isLoading: false,
      };
    });
    listWorkoutSessionsMock.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    });

    const data = useHistoryPageData();
    const historyQuery = useQueryMock.mock.calls.find(
      ([options]) => options.queryKey[0] === 'sessions',
    )?.[0];

    expect(data.items[0]?.startedAt).toBe('2026-03-05');
    await expect(historyQuery?.queryFn()).resolves.toEqual({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    });
    expect(listWorkoutSessionsMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: 'FINISHED',
    });
  });

  it('uses the server-backed workout streak query on dashboard instead of paged sessions', () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'user') {
        return {
          data: {
            timezone: 'UTC',
          },
          error: undefined,
          isLoading: false,
        };
      }

      if (queryKey[0] === 'checklist') {
        return {
          data: [],
          error: undefined,
          isLoading: false,
        };
      }

      if (queryKey[0] === 'templates') {
        return {
          data: [],
          error: undefined,
          isLoading: false,
        };
      }

      return {
        data: {
          currentStreakDays: 14,
          longestStreakDays: 20,
          lastCompletedDate: '2026-03-06',
        },
        error: undefined,
        isLoading: false,
      };
    });

    const data = useDashboardPageData();

    expect(data.workoutStreakDays).toBe(14);
    expect(
      useQueryMock.mock.calls.some(
        ([options]) => options.queryKey[0] === 'sessions',
      ),
    ).toBe(false);
  });

  it('blocks template builder advancement until the template name is present', () => {
    const setErrorMessage = vi.fn();
    useQueryMock.mockReturnValue({
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
        },
      },
      error: undefined,
      isLoading: false,
    });
    useMutationMock.mockReturnValue({
      error: undefined,
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useStateMock
      .mockReturnValueOnce([
        {
          description: '',
          exercises: [],
          name: '',
          step: 1,
        },
        vi.fn(),
      ])
      .mockReturnValueOnce([undefined, setErrorMessage]);

    const data = useTemplateBuilderPageData();

    data.onNext();
    expect(setErrorMessage).toHaveBeenCalledWith('Template name is required');
  });

  it('creates a workout template from the selected exercises and navigates to preview', async () => {
    const setFormState = vi.fn();
    useQueryMock.mockReturnValue({
      data: {
        items: [
          {
            id: 'exercise-bench',
            name: 'Bench Press',
            exerciseType: 'WEIGHT_REPS',
            description: null,
            primaryMuscle: null,
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
        },
      },
      error: undefined,
      isLoading: false,
    });
    createWorkoutTemplateMock.mockResolvedValue({
      id: 'template-created',
      name: 'Push Day A',
    });
    useMutationMock.mockImplementation(
      ({
        mutationFn,
        onSuccess,
      }: {
        mutationFn: () => Promise<unknown>;
        onSuccess?: (result: unknown) => Promise<void> | void;
      }) => ({
        error: undefined,
        isPending: false,
        mutateAsync: async () => {
          const result = await mutationFn();
          await onSuccess?.(result);
          return result;
        },
      }),
    );
    useStateMock
      .mockReturnValueOnce([
        {
          description: 'Controlled tempo and full range.',
          exercises: [
            {
              defaultSets: '4',
              id: 'exercise-bench',
              name: 'Bench Press',
              repMax: '8',
              repMin: '6',
              selected: true,
              supersetGroupKey: 'A',
            },
          ],
          name: 'Push Day A',
          step: 4,
        },
        setFormState,
      ])
      .mockReturnValueOnce([undefined, vi.fn()]);

    const data = useTemplateBuilderPageData();

    await expect(data.onSubmit()).resolves.toBeUndefined();
    expect(createWorkoutTemplateMock).toHaveBeenCalledWith({
      description: 'Controlled tempo and full range.',
      exercises: [
        {
          defaultSets: 4,
          exerciseTemplateId: 'exercise-bench',
          orderIndex: 0,
          repMax: 8,
          repMin: 6,
          supersetGroupKey: 'A',
        },
      ],
      name: 'Push Day A',
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['templates'],
    });
    expect(navigateMock).toHaveBeenCalledWith(
      '/workout/template-created/preview',
    );
  });

  it('normalizes invalid wizard step query params through the search params API', () => {
    const setSearchParams = vi.fn();
    useEffectMock.mockImplementation((effect: () => void) => effect());
    useSearchParamsMock.mockReturnValue([
      new URLSearchParams('step=999'),
      setSearchParams,
    ]);
    useQueryMock.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
    });
    useMutationMock.mockReturnValue({
      error: undefined,
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useStateMock
      .mockReturnValueOnce([initialWizardFormValues, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()]);

    const data = useExerciseWizardPageData();

    expect(data.step).toBe(7);
    expect(setSearchParams).toHaveBeenCalledWith(
      expect.objectContaining({
        get: expect.any(Function),
      }),
      { replace: true },
    );
    const normalizedParams = setSearchParams.mock.calls[0]?.[0] as
      | URLSearchParams
      | undefined;
    expect(normalizedParams?.get('step')).toBe('7');
  });

  it('swallows rejected wizard submissions after reporting the mutation error', async () => {
    const setErrorMessage = vi.fn();
    useSearchParamsMock.mockReturnValue([
      new URLSearchParams('step=7'),
      vi.fn(),
    ]);
    useQueryMock.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
    });
    useStateMock
      .mockReturnValueOnce([
        {
          ...initialWizardFormValues,
          name: 'Bench Press',
          primaryMuscleGroupId: 'muscle-1',
        },
        vi.fn(),
      ])
      .mockReturnValueOnce([undefined, setErrorMessage]);
    useMutationMock.mockImplementation(
      ({ onError }: { onError?: (error: unknown) => void }) => ({
        error: undefined,
        isPending: false,
        mutateAsync: vi.fn(async () => {
          const error = new Error('Create failed');
          onError?.(error);
          throw error;
        }),
      }),
    );

    const data = useExerciseWizardPageData();

    await expect(data.onSubmit()).resolves.toBeUndefined();
    expect(setErrorMessage).toHaveBeenCalledWith('Create failed');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('blocks wizard advancement when the current step is invalid', () => {
    const setErrorMessage = vi.fn();
    const setSearchParams = vi.fn();
    useSearchParamsMock.mockReturnValue([
      new URLSearchParams('step=1'),
      setSearchParams,
    ]);
    useQueryMock.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
    });
    useStateMock
      .mockReturnValueOnce([initialWizardFormValues, vi.fn()])
      .mockReturnValueOnce([undefined, setErrorMessage]);
    useMutationMock.mockReturnValue({
      error: undefined,
      isPending: false,
      mutateAsync: vi.fn(),
    });

    const data = useExerciseWizardPageData();

    data.onNext();
    expect(setErrorMessage).toHaveBeenCalledWith('Exercise name is required');
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('blocks wizard submission until required fields are present', async () => {
    const setErrorMessage = vi.fn();
    const mutateAsync = vi.fn();
    useSearchParamsMock.mockReturnValue([
      new URLSearchParams('step=7'),
      vi.fn(),
    ]);
    useQueryMock.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
    });
    useStateMock
      .mockReturnValueOnce([
        {
          ...initialWizardFormValues,
          name: 'Bench Press',
        },
        vi.fn(),
      ])
      .mockReturnValueOnce([undefined, setErrorMessage]);
    useMutationMock.mockReturnValue({
      error: undefined,
      isPending: false,
      mutateAsync,
    });

    const data = useExerciseWizardPageData();

    await expect(data.onSubmit()).resolves.toBeUndefined();
    expect(setErrorMessage).toHaveBeenCalledWith('Primary muscle is required');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('swallows rejected workout starts after the preview mutation reports the error', async () => {
    useQueryMock.mockReturnValue({
      data: {
        id: 'template-1',
        name: 'Push Day A',
        description: null,
        exercises: [],
      },
      error: undefined,
      isLoading: false,
    });
    useMutationMock.mockImplementation(() => ({
      error: new Error('Start failed'),
      isPending: false,
      mutateAsync: vi.fn(async () => {
        throw new Error('Start failed');
      }),
    }));
    useActiveWorkoutStoreMock.mockImplementation(
      (selector: (state: { start: () => void }) => unknown) =>
        selector({
          start: vi.fn(),
        }),
    );

    const data = useWorkoutPreviewPageData('template-1');

    await expect(data.onStartWorkout()).resolves.toBeUndefined();
    expect(data.errorMessage).toBe('Start failed');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('prefers templates that cover the least-worked muscle and uses the shared streak query on completion', () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'user') {
        return {
          data: {
            timezone: 'UTC',
          },
          error: undefined,
          isLoading: false,
        };
      }

      if (queryKey[0] === 'progress') {
        return {
          data: {
            coveragePercent: 50,
            perMuscleVolume: [
              { id: 'chest', name: 'Chest', volume: 10 },
              { id: 'back', name: 'Back', volume: 50 },
            ],
          },
          error: undefined,
          isLoading: false,
        };
      }

      if (queryKey[0] === 'templates') {
        return {
          data: [
            {
              id: 'template-back',
              name: 'Back Day',
              exercises: [{ id: 'one' }],
              muscleCoverage: ['Back'],
            },
            {
              id: 'template-chest',
              name: 'Push Day',
              exercises: [{ id: 'two' }],
              muscleCoverage: ['Chest'],
            },
          ],
          error: undefined,
          isLoading: false,
        };
      }

      return {
        data: {
          currentStreakDays: 9,
          longestStreakDays: 12,
          lastCompletedDate: '2026-03-06',
        },
        error: undefined,
        isLoading: false,
      };
    });

    const data = useCompletionFlowData();

    expect(data.recommendedTemplate?.id).toBe('template-chest');
    expect(data.streakDays).toBe(9);
    expect(
      useQueryMock.mock.calls.some(
        ([options]) =>
          JSON.stringify(options.queryKey) === JSON.stringify(['templates']),
      ),
    ).toBe(true);
    expect(
      useQueryMock.mock.calls.some(
        ([options]) =>
          JSON.stringify(options.queryKey) ===
          JSON.stringify(['templates', 'completion']),
      ),
    ).toBe(false);
  });

  it('maps exercise detail and history data from the API-backed queries', () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'exercise' && queryKey[2] === 'detail') {
        return {
          data: {
            id: 'exercise-bench',
            name: 'Bench Press',
            description: 'Pause on the chest and drive through the bar.',
            exerciseType: 'WEIGHT_REPS',
            primaryMuscle: {
              id: 'muscle-1',
              name: 'Chest',
            },
            secondaryMuscles: [
              { muscleGroup: { id: 'muscle-2', name: 'Shoulders' } },
              { muscleGroup: { id: 'muscle-3', name: 'Triceps' } },
            ],
            equipment: [
              { equipment: { id: 'equipment-1', name: 'Barbell' } },
              { equipment: { id: 'equipment-2', name: 'Bench' } },
            ],
            defaultSets: 4,
            repMin: 6,
            repMax: 8,
            defaultCues: 'Keep wrists stacked over elbows.',
            notes: [{ note: 'Keep wrists stacked over elbows.' }],
          },
          error: undefined,
          isLoading: false,
        };
      }

      if (queryKey[0] === 'exercise' && queryKey[2] === 'history') {
        return {
          data: {
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
                    finishedAt: '2026-03-05T12:32:00.000Z',
                  },
                },
              },
            ],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 1,
            },
          },
          error: undefined,
          isLoading: false,
        };
      }

      return {
        data: {
          timezone: 'UTC',
        },
        error: undefined,
        isLoading: false,
      };
    });

    const data = useExerciseDetailPageData();

    expect(data.exercise).toEqual({
      defaultSetsLabel: '4 sets',
      description: 'Pause on the chest and drive through the bar.',
      equipment: ['Barbell', 'Bench'],
      exerciseTypeLabel: 'Weight + Reps',
      name: 'Bench Press',
      note: 'Keep wrists stacked over elbows.',
      primaryMuscle: 'Chest',
      repRangeLabel: '6-8 reps',
      secondaryMuscles: ['Shoulders', 'Triceps'],
    });
    expect(data.historyItems).toEqual([
      {
        id: 'set-1',
        performanceLabel: '100 x 8',
        startedAt: '2026-03-05',
      },
    ]);
  });

  it('reports a detail-page error when the exercise id is missing', () => {
    useParamsMock.mockReturnValue({ id: undefined } as unknown as {
      id: string;
    });
    useQueryMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });

    const data = useExerciseDetailPageData();

    expect(data.errorMessage).toBe('Exercise not found.');
    expect(data.exercise).toBeUndefined();
    expect(data.historyItems).toEqual([]);
  });

  it('clears auth state and navigates away after delete even when logout fails', async () => {
    useStateMock
      .mockReturnValueOnce(['Name', vi.fn()])
      .mockReturnValueOnce(['UTC', vi.fn()])
      .mockReturnValueOnce(['METRIC', vi.fn()])
      .mockReturnValueOnce(['90', vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()]);
    useQueryMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    useMutationMock.mockReturnValue({
      error: undefined,
      isPending: false,
      mutateAsync: vi.fn(),
    });
    deleteCurrentUserMock.mockResolvedValue({ success: true });
    logoutCurrentSessionMock.mockRejectedValue(new Error('Logout failed'));

    const data = useSettingsPageData();

    await expect(data.onDeleteAccount()).resolves.toBeUndefined();
    expect(deleteCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(logoutCurrentSessionMock).toHaveBeenCalledTimes(1);
    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/register');
  });

  it('swallows logout failures and reports the error instead of rejecting', async () => {
    const setErrorMessage = vi.fn();
    useStateMock
      .mockReturnValueOnce(['Name', vi.fn()])
      .mockReturnValueOnce(['UTC', vi.fn()])
      .mockReturnValueOnce(['METRIC', vi.fn()])
      .mockReturnValueOnce(['90', vi.fn()])
      .mockReturnValueOnce([undefined, setErrorMessage]);
    useQueryMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    useMutationMock.mockReturnValue({
      error: undefined,
      isPending: false,
      mutateAsync: vi.fn(),
    });
    logoutCurrentSessionMock.mockRejectedValue(new Error('Logout failed'));

    const data = useSettingsPageData();

    await expect(data.onLogout()).resolves.toBeUndefined();
    expect(setErrorMessage).toHaveBeenCalledWith('Logout failed');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('handles incomplete-workout confirmation failures without rejecting', async () => {
    const setErrorMessage = vi.fn();
    const finish = vi.fn();
    useStateMock
      .mockReturnValueOnce([undefined, setErrorMessage])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(['', vi.fn()]);
    useQueryMock.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          state: string;
          sessionId?: string;
          startedAt?: string;
          exercises: Array<{
            id: string;
            name: string;
            orderIndex: number;
            sets: Array<{
              id: string;
              orderIndex: number;
              isCompleted: boolean;
            }>;
          }>;
          updateSet: () => void;
          removeExercise: () => void;
          reorderExercises: () => void;
          finish: typeof finish;
          restTimerSeconds: number;
          start: () => void;
        }) => unknown,
      ) =>
        selector({
          exercises: [
            {
              id: 'se-1',
              name: 'Bench Press',
              orderIndex: 0,
              sets: [
                {
                  id: 'set-1',
                  orderIndex: 0,
                  isCompleted: false,
                },
              ],
            },
          ],
          finish,
          removeExercise: vi.fn(),
          reorderExercises: vi.fn(),
          restTimerSeconds: 0,
          sessionId: 'session-1',
          start: vi.fn(),
          startedAt: '2026-03-06T12:00:00.000Z',
          state: 'IN_PROGRESS',
          updateSet: vi.fn(),
        }),
    );
    finishWorkoutSessionMock.mockRejectedValue(new Error('Finish failed'));

    const data = useActiveWorkoutPageData();

    await expect(data.incomplete.onConfirm()).resolves.toBeUndefined();
    expect(setErrorMessage).toHaveBeenCalledWith('Finish failed');
    expect(finish).not.toHaveBeenCalled();
  });

  it('opens a notes modal instead of using the blocking prompt dialog', async () => {
    const setShowOverflow = vi.fn();
    const setShowNotes = vi.fn();
    const setNotesDraft = vi.fn();
    const promptMock = vi.fn();
    useStateMock
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce(['se-1', vi.fn()])
      .mockReturnValueOnce([true, setShowOverflow])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([false, setShowNotes])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(['', setNotesDraft]);
    useQueryMock.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      isSuccess: false,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          state: string;
          sessionId?: string;
          startedAt?: string;
          exercises: Array<{
            id: string;
            name: string;
            notes?: string;
            orderIndex: number;
            sets: Array<{
              id: string;
              orderIndex: number;
              isCompleted: boolean;
            }>;
          }>;
          updateSet: () => void;
          removeExercise: () => void;
          reorderExercises: () => void;
          finish: () => void;
          restTimerSeconds: number;
          start: () => void;
          clear: () => void;
          syncFromServer: () => void;
        }) => unknown,
      ) =>
        selector({
          exercises: [
            {
              id: 'se-1',
              name: 'Bench Press',
              notes: 'Keep elbows tucked',
              orderIndex: 0,
              sets: [],
            },
          ],
          finish: vi.fn(),
          removeExercise: vi.fn(),
          reorderExercises: vi.fn(),
          restTimerSeconds: 0,
          sessionId: 'session-1',
          start: vi.fn(),
          startedAt: '2026-03-06T12:00:00.000Z',
          state: 'IN_PROGRESS',
          updateSet: vi.fn(),
          clear: vi.fn(),
          syncFromServer: vi.fn(),
        }),
    );
    vi.stubGlobal('prompt', promptMock);

    const data = useActiveWorkoutPageData();

    await expect(data.overflow.onEditNotes()).resolves.toBeUndefined();
    expect(promptMock).not.toHaveBeenCalled();
    expect(setNotesDraft).toHaveBeenCalledWith('Keep elbows tucked');
    expect(setShowNotes).toHaveBeenCalledWith(true);
    expect(setShowOverflow).toHaveBeenCalledWith(false);
  });

  it('syncs manual active-session refreshes back into the query cache', async () => {
    const syncFromServer = vi.fn();
    const session = {
      id: 'session-1',
      workoutTemplateId: 'template-1',
      startedAt: '2026-03-06T12:00:00.000Z',
      durationSeconds: 1200,
      totalVolume: 3200,
      status: 'IN_PROGRESS',
      sessionExercises: [],
    };
    useStateMock
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce(['se-1', vi.fn()])
      .mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(['updated notes', vi.fn()]);
    useQueryMock.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      isSuccess: false,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          state: string;
          sessionId?: string;
          startedAt?: string;
          exercises: Array<{
            id: string;
            name: string;
            orderIndex: number;
            notes?: string;
            sets: Array<{
              id: string;
              orderIndex: number;
              isCompleted: boolean;
            }>;
          }>;
          updateSet: () => void;
          removeExercise: () => void;
          reorderExercises: () => void;
          finish: () => void;
          restTimerSeconds: number;
          start: () => void;
          clear: () => void;
          syncFromServer: typeof syncFromServer;
        }) => unknown,
      ) =>
        selector({
          clear: vi.fn(),
          exercises: [
            {
              id: 'se-1',
              name: 'Bench Press',
              notes: 'Keep elbows tucked',
              orderIndex: 0,
              sets: [],
            },
          ],
          finish: vi.fn(),
          removeExercise: vi.fn(),
          reorderExercises: vi.fn(),
          restTimerSeconds: 0,
          sessionId: 'session-1',
          start: vi.fn(),
          startedAt: '2026-03-06T12:00:00.000Z',
          state: 'IN_PROGRESS',
          syncFromServer,
          updateSet: vi.fn(),
        }),
    );
    updateWorkoutExerciseMock.mockResolvedValue({
      id: 'se-1',
    });
    fetchActiveSessionMock.mockResolvedValue(session);

    const data = useActiveWorkoutPageData();

    await expect(data.notes.onSave()).resolves.toBeUndefined();
    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ['active-session'],
      session,
    );
    expect(syncFromServer).toHaveBeenCalledWith('session-1', [], {
      startedAt: '2026-03-06T12:00:00.000Z',
    });
  });

  it('handles exercise swap failures without rejecting or navigating away', async () => {
    const setErrorMessage = vi.fn();
    useStateMock.mockReturnValueOnce([undefined, setErrorMessage]);
    useSearchParamsMock.mockReturnValue([
      new URLSearchParams('sessionExerciseId=se-1'),
      vi.fn(),
    ]);
    useQueryMock.mockReturnValue({
      data: {
        items: [{ id: 'exercise-bench', name: 'Bench Press' }],
        pagination: {
          page: 1,
          pageSize: 1,
          total: 1,
        },
      },
      error: undefined,
      isLoading: false,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: { sessionId?: string; start: () => void }) => unknown,
      ) =>
        selector({
          sessionId: 'session-1',
          start: vi.fn(),
        }),
    );
    swapWorkoutExerciseMock.mockRejectedValue(new Error('Swap failed'));

    const data = useExerciseSelectPageData();

    await expect(
      data.onSelectExercise('exercise-bench'),
    ).resolves.toBeUndefined();
    expect(setErrorMessage).toHaveBeenCalledWith('Swap failed');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('clears stale active workout state when the server no longer has an active session', () => {
    const clear = vi.fn();
    const setErrorMessage = vi.fn();
    useEffectMock.mockImplementation((effect: () => void) => effect());
    useStateMock
      .mockReturnValueOnce([undefined, setErrorMessage])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(['', vi.fn()]);
    useQueryMock.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      isSuccess: true,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          state: string;
          sessionId?: string;
          startedAt?: string;
          exercises: Array<unknown>;
          updateSet: () => void;
          removeExercise: () => void;
          reorderExercises: () => void;
          finish: () => void;
          restTimerSeconds: number;
          start: () => void;
          clear: typeof clear;
          syncFromServer: () => void;
        }) => unknown,
      ) =>
        selector({
          exercises: [],
          finish: vi.fn(),
          removeExercise: vi.fn(),
          reorderExercises: vi.fn(),
          restTimerSeconds: 0,
          sessionId: 'session-1',
          start: vi.fn(),
          startedAt: '2026-03-06T12:00:00.000Z',
          state: 'IN_PROGRESS',
          updateSet: vi.fn(),
          clear,
          syncFromServer: vi.fn(),
        }),
    );

    useActiveWorkoutPageData();

    expect(clear).toHaveBeenCalledTimes(1);
    expect(setErrorMessage).toHaveBeenCalledWith(
      'Workout session is no longer available',
    );
  });

  it('syncs refreshed active-session data for the same session without restarting the workout', () => {
    const syncFromServer = vi.fn();
    const start = vi.fn();
    useEffectMock.mockImplementation((effect: () => void) => effect());
    useStateMock
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(['', vi.fn()]);
    useQueryMock.mockReturnValue({
      data: {
        id: 'session-1',
        startedAt: '2026-03-06T12:00:00.000Z',
        sessionExercises: [
          {
            id: 'session-exercise-1',
            exerciseTemplateId: 'exercise-1',
            orderIndex: 0,
            notes: null,
            supersetGroupKey: null,
            exercise: { id: 'exercise-1', name: 'Bench Press' },
            sets: [],
          },
        ],
      },
      error: undefined,
      isLoading: false,
      isSuccess: true,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          state: string;
          sessionId?: string;
          startedAt?: string;
          exercises: Array<unknown>;
          updateSet: () => void;
          removeExercise: () => void;
          reorderExercises: () => void;
          finish: () => void;
          restTimerSeconds: number;
          start: typeof start;
          clear: () => void;
          syncFromServer: typeof syncFromServer;
        }) => unknown,
      ) =>
        selector({
          exercises: [],
          finish: vi.fn(),
          removeExercise: vi.fn(),
          reorderExercises: vi.fn(),
          restTimerSeconds: 0,
          sessionId: 'session-1',
          start,
          startedAt: '2026-03-06T12:00:00.000Z',
          state: 'IN_PROGRESS',
          updateSet: vi.fn(),
          clear: vi.fn(),
          syncFromServer,
        }),
    );

    useActiveWorkoutPageData();

    expect(syncFromServer).toHaveBeenCalledWith(
      'session-1',
      [
        expect.objectContaining({
          id: 'session-exercise-1',
          name: 'Bench Press',
        }),
      ],
      {
        startedAt: '2026-03-06T12:00:00.000Z',
      },
    );
    expect(start).not.toHaveBeenCalled();
  });

  it('optimistically toggles sets and rolls back when the API call fails', async () => {
    const setErrorMessage = vi.fn();
    const updateSet = vi.fn();
    useStateMock
      .mockReturnValueOnce([undefined, setErrorMessage])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(['', vi.fn()]);
    useQueryMock.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      isSuccess: false,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          state: string;
          sessionId?: string;
          startedAt?: string;
          exercises: Array<{
            id: string;
            name: string;
            orderIndex: number;
            sets: Array<{
              id: string;
              orderIndex: number;
              isCompleted: boolean;
              reps?: number;
              weight?: number;
              durationSeconds?: number;
            }>;
          }>;
          updateSet: typeof updateSet;
          removeExercise: () => void;
          reorderExercises: () => void;
          finish: () => void;
          restTimerSeconds: number;
          start: () => void;
          clear: () => void;
          syncFromServer: () => void;
        }) => unknown,
      ) =>
        selector({
          exercises: [
            {
              id: 'se-1',
              name: 'Bench Press',
              orderIndex: 0,
              sets: [
                {
                  id: 'set-1',
                  orderIndex: 0,
                  isCompleted: false,
                  reps: 8,
                  weight: 100,
                },
              ],
            },
          ],
          finish: vi.fn(),
          removeExercise: vi.fn(),
          reorderExercises: vi.fn(),
          restTimerSeconds: 0,
          sessionId: 'session-1',
          start: vi.fn(),
          startedAt: '2026-03-06T12:00:00.000Z',
          state: 'IN_PROGRESS',
          updateSet,
          clear: vi.fn(),
          syncFromServer: vi.fn(),
        }),
    );
    toggleWorkoutSetCompletionMock.mockRejectedValue(
      new Error('Toggle failed'),
    );

    const data = useActiveWorkoutPageData();

    await expect(
      data.onToggleSet('se-1', 'set-1', true),
    ).resolves.toBeUndefined();
    expect(updateSet).toHaveBeenNthCalledWith(1, 'se-1', 'set-1', {
      isCompleted: true,
    });
    expect(updateSet).toHaveBeenNthCalledWith(2, 'se-1', 'set-1', {
      durationSeconds: undefined,
      isCompleted: false,
      reps: 8,
      weight: 100,
    });
    expect(setErrorMessage).toHaveBeenCalledWith('Toggle failed');
  });

  it('applies supersets through a single atomic session endpoint', async () => {
    const syncFromServer = vi.fn();
    useStateMock
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([true, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([[], vi.fn()])
      .mockReturnValueOnce([['se-1', 'se-2'], vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([undefined, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce(['', vi.fn()]);
    useQueryMock.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      isSuccess: false,
    });
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          state: string;
          sessionId?: string;
          startedAt?: string;
          exercises: Array<{
            id: string;
            name: string;
            orderIndex: number;
            sets: Array<unknown>;
          }>;
          updateSet: () => void;
          removeExercise: () => void;
          reorderExercises: () => void;
          finish: () => void;
          restTimerSeconds: number;
          start: () => void;
          clear: () => void;
          syncFromServer: typeof syncFromServer;
        }) => unknown,
      ) =>
        selector({
          exercises: [
            { id: 'se-1', name: 'Bench Press', orderIndex: 0, sets: [] },
            { id: 'se-2', name: 'Rows', orderIndex: 1, sets: [] },
            { id: 'se-3', name: 'Squat', orderIndex: 2, sets: [] },
          ],
          finish: vi.fn(),
          removeExercise: vi.fn(),
          reorderExercises: vi.fn(),
          restTimerSeconds: 0,
          sessionId: 'session-1',
          start: vi.fn(),
          startedAt: '2026-03-06T12:00:00.000Z',
          state: 'IN_PROGRESS',
          updateSet: vi.fn(),
          clear: vi.fn(),
          syncFromServer,
        }),
    );
    applyWorkoutSupersetMock.mockResolvedValue({
      id: 'session-1',
      startedAt: '2026-03-06T12:00:00.000Z',
      sessionExercises: [
        {
          id: 'se-1',
          exerciseTemplateId: 'exercise-1',
          orderIndex: 0,
          notes: null,
          supersetGroupKey: 'group-1',
          exercise: { id: 'exercise-1', name: 'Bench Press' },
          sets: [],
        },
        {
          id: 'se-2',
          exerciseTemplateId: 'exercise-2',
          orderIndex: 1,
          notes: null,
          supersetGroupKey: 'group-1',
          exercise: { id: 'exercise-2', name: 'Rows' },
          sets: [],
        },
      ],
    });

    const data = useActiveWorkoutPageData();

    await expect(data.superset.onApply()).resolves.toBeUndefined();
    expect(applyWorkoutSupersetMock).toHaveBeenCalledWith('session-1', [
      'se-1',
      'se-2',
    ]);
    expect(syncFromServer).toHaveBeenCalledWith(
      'session-1',
      [
        expect.objectContaining({ id: 'se-1', supersetGroupKey: 'group-1' }),
        expect.objectContaining({ id: 'se-2', supersetGroupKey: 'group-1' }),
      ],
      {
        startedAt: '2026-03-06T12:00:00.000Z',
      },
    );
  });
});
