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

interface ActiveWorkoutState {
  state: WorkoutFlowState;
  sessionId?: string;
  startedAt?: string;
  exercises: SessionExercise[];
  restTimerSeconds: number;
  restTimerActive: boolean;
  completeSummary?: {
    totalVolume: number;
    durationSeconds: number;
    prs: number;
  };
  start: (sessionId: string, exercises: SessionExercise[]) => void;
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
  tickRestTimer: () => void;
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

const activeWorkoutStorage = createJSONStorage<ActiveWorkoutState>(() => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createNoopStorage();
  }
  return window.localStorage;
});

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      state: 'IDLE',
      sessionId: undefined,
      startedAt: undefined,
      exercises: [],
      restTimerSeconds: 0,
      restTimerActive: false,
      completeSummary: undefined,
      start: (sessionId, exercises) =>
        set({
          state: 'IN_PROGRESS',
          sessionId,
          startedAt: new Date().toISOString(),
          exercises,
          completeSummary: undefined,
        }),
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

          if (patch.isCompleted) {
            return {
              exercises: nextExercises,
              restTimerSeconds: 90,
              restTimerActive: true,
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
          completeSummary: summary,
          restTimerActive: false,
          restTimerSeconds: 0,
        }),
      setRestTimer: (seconds) =>
        set({ restTimerSeconds: seconds, restTimerActive: seconds > 0 }),
      tickRestTimer: () => {
        const { restTimerSeconds, restTimerActive } = get();
        if (!restTimerActive) {
          return;
        }

        if (restTimerSeconds <= 1) {
          set({ restTimerSeconds: 0, restTimerActive: false });
          return;
        }

        set({ restTimerSeconds: restTimerSeconds - 1 });
      },
      clear: () =>
        set({
          state: 'IDLE',
          sessionId: undefined,
          startedAt: undefined,
          exercises: [],
          restTimerSeconds: 0,
          restTimerActive: false,
          completeSummary: undefined,
        }),
    }),
    {
      name: 'irontrack-active-workout',
      storage: activeWorkoutStorage,
    },
  ),
);
