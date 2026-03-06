import type { FormEvent } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeWorkoutStreakDays,
  getTodayDate,
  useActiveWorkoutPageData,
  useDashboardPageData,
  useSettingsPageData,
} from './web-data';

const useStateMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useMemoMock = vi.hoisted(() =>
  vi.fn((factory: () => unknown) => factory()),
);
const navigateMock = vi.hoisted(() => vi.fn());
const useNavigateMock = vi.hoisted(() => vi.fn(() => navigateMock));
const useSearchParamsMock = vi.hoisted(() =>
  vi.fn(() => [new URLSearchParams(), vi.fn()]),
);
const useQueryMock = vi.hoisted(() => vi.fn());
const useMutationMock = vi.hoisted(() => vi.fn());
const useQueryClientMock = vi.hoisted(() => vi.fn());
const logoutCurrentSessionMock = vi.hoisted(() => vi.fn());
const clearAuthSessionMock = vi.hoisted(() => vi.fn());
const deleteCurrentUserMock = vi.hoisted(() => vi.fn());
const finishWorkoutSessionMock = vi.hoisted(() => vi.fn());
const useRestTimerMock = vi.hoisted(() => vi.fn());
const useActiveWorkoutStoreMock = vi.hoisted(() => vi.fn());

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
    deleteCurrentUser: deleteCurrentUserMock,
    finishWorkoutSession: finishWorkoutSessionMock,
  };
});

describe('web-data', () => {
  const queryClient = {
    invalidateQueries: vi.fn(),
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
      .mockReturnValueOnce([[], vi.fn()]);
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
});
