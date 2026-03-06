import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

export type WorkoutFlowState =
  | 'IDLE'
  | 'STARTING'
  | 'IN_PROGRESS'
  | 'FINISHING'
  | 'COMPLETED';

export interface WorkoutSet {
  id: string;
  orderIndex: number;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  isCompleted: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseTemplateId: string;
  name: string;
  orderIndex: number;
  supersetGroupKey?: string;
  notes?: string;
  sets: WorkoutSet[];
}

const ACTIVE_WORKOUT_STORE_VERSION = 1;

interface ActiveWorkoutState {
  state: WorkoutFlowState;
  sessionId?: string;
  startedAt?: string;
  exercises: SessionExercise[];
  restTimerSeconds: number;
  restTimerEndsAt?: number;
  restTimerActive: boolean;
  restTimerDefaultSeconds: number;
  completeSummary?: {
    totalVolume: number;
    durationSeconds: number;
    prs: number;
  };
  start: (
    sessionId: string,
    exercises: SessionExercise[],
    options?: {
      startedAt?: string;
    },
  ) => void;
  syncFromServer: (
    sessionId: string,
    exercises: SessionExercise[],
    options?: {
      startedAt?: string;
    },
  ) => void;
  addExercise: (exercise: SessionExercise) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (items: Array<{ id: string; orderIndex: number }>) => void;
  addSet: (exerciseId: string, set: WorkoutSet) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    patch: Partial<WorkoutSet>,
  ) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  setSuperset: (exerciseId: string, key?: string) => void;
  finish: (summary: {
    totalVolume: number;
    durationSeconds: number;
    prs: number;
  }) => void;
  setRestTimer: (seconds: number) => void;
  setRestTimerDefault: (seconds: number) => void;
  tickRestTimer: (nowMs?: number) => void;
  clear: () => void;
}

function applyExerciseOrder(
  exercises: SessionExercise[],
  items: Array<{ id: string; orderIndex: number }>,
) {
  const orderMap = new Map(items.map((item) => [item.id, item.orderIndex]));
  return exercises
    .map((exercise) => ({
      ...exercise,
      orderIndex: orderMap.get(exercise.id) ?? exercise.orderIndex,
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

function createNoopStorage(): StateStorage {
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
}

function createInitialWorkoutSnapshot() {
  return {
    state: 'IDLE' as WorkoutFlowState,
    sessionId: undefined as string | undefined,
    startedAt: undefined as string | undefined,
    exercises: [] as SessionExercise[],
    restTimerSeconds: 0,
    restTimerEndsAt: undefined as number | undefined,
    restTimerActive: false,
    restTimerDefaultSeconds: 90,
    completeSummary: undefined as
      | {
          totalVolume: number;
          durationSeconds: number;
          prs: number;
        }
      | undefined,
  };
}

function isWorkoutFlowState(value: unknown): value is WorkoutFlowState {
  return (
    value === 'IDLE' ||
    value === 'STARTING' ||
    value === 'IN_PROGRESS' ||
    value === 'FINISHING' ||
    value === 'COMPLETED'
  );
}

function normalizePersistedWorkoutState(persistedState: unknown) {
  const initialState = createInitialWorkoutSnapshot();
  if (!persistedState || typeof persistedState !== 'object') {
    return initialState;
  }

  const maybeState = persistedState as Partial<typeof initialState>;
  return {
    state: isWorkoutFlowState(maybeState.state)
      ? maybeState.state
      : initialState.state,
    sessionId:
      typeof maybeState.sessionId === 'string'
        ? maybeState.sessionId
        : initialState.sessionId,
    startedAt:
      typeof maybeState.startedAt === 'string'
        ? maybeState.startedAt
        : initialState.startedAt,
    exercises: Array.isArray(maybeState.exercises)
      ? maybeState.exercises
      : initialState.exercises,
    restTimerSeconds:
      typeof maybeState.restTimerSeconds === 'number' &&
      Number.isFinite(maybeState.restTimerSeconds)
        ? maybeState.restTimerSeconds
        : initialState.restTimerSeconds,
    restTimerEndsAt:
      typeof maybeState.restTimerEndsAt === 'number' &&
      Number.isFinite(maybeState.restTimerEndsAt)
        ? maybeState.restTimerEndsAt
        : initialState.restTimerEndsAt,
    restTimerActive:
      typeof maybeState.restTimerActive === 'boolean'
        ? maybeState.restTimerActive
        : initialState.restTimerActive,
    restTimerDefaultSeconds:
      typeof maybeState.restTimerDefaultSeconds === 'number' &&
      Number.isFinite(maybeState.restTimerDefaultSeconds) &&
      maybeState.restTimerDefaultSeconds > 0
        ? maybeState.restTimerDefaultSeconds
        : initialState.restTimerDefaultSeconds,
    completeSummary:
      maybeState.completeSummary &&
      typeof maybeState.completeSummary === 'object' &&
      typeof maybeState.completeSummary.totalVolume === 'number' &&
      typeof maybeState.completeSummary.durationSeconds === 'number' &&
      typeof maybeState.completeSummary.prs === 'number'
        ? maybeState.completeSummary
        : initialState.completeSummary,
  };
}

const activeWorkoutStorage = createJSONStorage<ActiveWorkoutState>(() => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createNoopStorage();
  }
  return window.localStorage;
});

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      ...createInitialWorkoutSnapshot(),
      start: (sessionId, exercises, options) =>
        set({
          state: 'IN_PROGRESS',
          sessionId,
          startedAt: options?.startedAt ?? new Date().toISOString(),
          exercises,
          restTimerSeconds: 0,
          restTimerEndsAt: undefined,
          restTimerActive: false,
          completeSummary: undefined,
        }),
      syncFromServer: (sessionId, exercises, options) =>
        set((current) => ({
          state: 'IN_PROGRESS',
          sessionId,
          startedAt: options?.startedAt ?? current.startedAt,
          exercises,
          restTimerSeconds:
            current.sessionId === sessionId ? current.restTimerSeconds : 0,
          restTimerEndsAt:
            current.sessionId === sessionId
              ? current.restTimerEndsAt
              : undefined,
          restTimerActive:
            current.sessionId === sessionId ? current.restTimerActive : false,
          completeSummary: undefined,
        })),
      addExercise: (exercise) =>
        set((current) => ({
          exercises: [...current.exercises, exercise].sort(
            (a, b) => a.orderIndex - b.orderIndex,
          ),
        })),
      removeExercise: (exerciseId) =>
        set((current) => ({
          exercises: current.exercises.filter(
            (exercise) => exercise.id !== exerciseId,
          ),
        })),
      reorderExercises: (items) =>
        set((current) => ({
          exercises: applyExerciseOrder(current.exercises, items),
        })),
      addSet: (exerciseId, setToAdd) =>
        set((current) => ({
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  sets: [...exercise.sets, setToAdd].sort(
                    (a, b) => a.orderIndex - b.orderIndex,
                  ),
                }
              : exercise,
          ),
        })),
      updateSet: (exerciseId, setId, patch) =>
        set((current) => {
          const nextExercises = current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  sets: exercise.sets.map((setItem) =>
                    setItem.id === setId ? { ...setItem, ...patch } : setItem,
                  ),
                }
              : exercise,
          );

          if (patch.isCompleted === true) {
            const restTimerSeconds = current.restTimerDefaultSeconds;
            return {
              exercises: nextExercises,
              restTimerSeconds,
              restTimerEndsAt: Date.now() + restTimerSeconds * 1000,
              restTimerActive: restTimerSeconds > 0,
            };
          }

          if (patch.isCompleted === false) {
            return {
              exercises: nextExercises,
              restTimerSeconds: 0,
              restTimerEndsAt: undefined,
              restTimerActive: false,
            };
          }

          return { exercises: nextExercises };
        }),
      removeSet: (exerciseId, setId) =>
        set((current) => ({
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  sets: exercise.sets.filter((setItem) => setItem.id !== setId),
                }
              : exercise,
          ),
        })),
      setSuperset: (exerciseId, key) =>
        set((current) => ({
          exercises: current.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? { ...exercise, supersetGroupKey: key }
              : exercise,
          ),
        })),
      finish: (summary) =>
        set({
          state: 'COMPLETED',
          sessionId: undefined,
          completeSummary: summary,
          restTimerActive: false,
          restTimerSeconds: 0,
          restTimerEndsAt: undefined,
        }),
      setRestTimer: (seconds) =>
        set({
          restTimerSeconds: seconds,
          restTimerEndsAt:
            seconds > 0 ? Date.now() + seconds * 1000 : undefined,
          restTimerActive: seconds > 0,
        }),
      setRestTimerDefault: (seconds) =>
        set({
          restTimerDefaultSeconds: Math.max(1, Math.trunc(seconds)),
        }),
      tickRestTimer: (nowMs = Date.now()) => {
        const { restTimerEndsAt, restTimerActive } = get();
        if (!restTimerActive || !restTimerEndsAt) {
          return;
        }

        const remainingSeconds = Math.max(
          0,
          Math.ceil((restTimerEndsAt - nowMs) / 1000),
        );

        if (remainingSeconds <= 0) {
          set({
            restTimerSeconds: 0,
            restTimerEndsAt: undefined,
            restTimerActive: false,
          });
          return;
        }

        set({ restTimerSeconds: remainingSeconds });
      },
      clear: () => set(createInitialWorkoutSnapshot()),
    }),
    {
      migrate: ((persistedState: unknown) =>
        normalizePersistedWorkoutState(persistedState)) as unknown as (
        persistedState: unknown,
        version: number,
      ) => ActiveWorkoutState,
      name: 'irontrack-active-workout',
      storage: activeWorkoutStorage,
      version: ACTIVE_WORKOUT_STORE_VERSION,
    },
  ),
);
