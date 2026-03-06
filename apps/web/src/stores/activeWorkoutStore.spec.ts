import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useActiveWorkoutStore } from './activeWorkoutStore';
import type { SessionExercise, WorkoutSet } from './activeWorkoutStore';

const makeSet = (id: string, orderIndex: number): WorkoutSet => ({
  id,
  orderIndex,
  reps: 8,
  weight: 100,
  isCompleted: false,
});

const makeExercise = (
  id: string,
  orderIndex: number,
  sets: WorkoutSet[] = [makeSet(`${id}-set-1`, 0)],
): SessionExercise => ({
  id,
  exerciseTemplateId: `${id}-template`,
  name: `${id}-name`,
  orderIndex,
  sets,
});

describe('activeWorkoutStore', () => {
  beforeEach(() => {
    useActiveWorkoutStore.getState().clear();
  });

  it('rehydrates without browser localStorage', async () => {
    await expect(
      useActiveWorkoutStore.persist.rehydrate(),
    ).resolves.toBeUndefined();
    expect(useActiveWorkoutStore.persist.clearStorage()).toBeUndefined();
  });

  it('supports start -> finish -> clear flow', () => {
    const { start, finish, clear } = useActiveWorkoutStore.getState();
    const sessionExercises: SessionExercise[] = [makeExercise('se-1', 0)];

    start('session-1', sessionExercises, {
      startedAt: '2026-03-06T12:00:00.000Z',
    });
    expect(useActiveWorkoutStore.getState().state).toBe('IN_PROGRESS');
    expect(useActiveWorkoutStore.getState().sessionId).toBe('session-1');
    expect(useActiveWorkoutStore.getState().startedAt).toBe(
      '2026-03-06T12:00:00.000Z',
    );

    const summary = { totalVolume: 1000, durationSeconds: 1200, prs: 1 };
    finish(summary);
    expect(useActiveWorkoutStore.getState().state).toBe('COMPLETED');
    expect(useActiveWorkoutStore.getState().sessionId).toBeUndefined();
    expect(useActiveWorkoutStore.getState().completeSummary).toEqual(summary);

    clear();
    expect(useActiveWorkoutStore.getState()).toMatchObject({
      state: 'IDLE',
      sessionId: undefined,
      startedAt: undefined,
      exercises: [],
      restTimerSeconds: 0,
      restTimerActive: false,
      restTimerDefaultSeconds: 90,
      completeSummary: undefined,
    });
  });

  it('adds, removes and reorders exercises', () => {
    const { start, addExercise, removeExercise, reorderExercises } =
      useActiveWorkoutStore.getState();

    start('session-2', [makeExercise('e1', 2)]);
    addExercise(makeExercise('e2', 0));
    addExercise(makeExercise('e3', 1));

    expect(useActiveWorkoutStore.getState().exercises.map((x) => x.id)).toEqual(
      ['e2', 'e3', 'e1'],
    );

    reorderExercises([
      { id: 'e1', orderIndex: 0 },
      { id: 'e2', orderIndex: 2 },
    ]);
    expect(useActiveWorkoutStore.getState().exercises.map((x) => x.id)).toEqual(
      ['e1', 'e3', 'e2'],
    );

    removeExercise('e3');
    expect(useActiveWorkoutStore.getState().exercises.map((x) => x.id)).toEqual(
      ['e1', 'e2'],
    );
  });

  it('adds sets in order and only mutates target exercise', () => {
    const { start, addSet } = useActiveWorkoutStore.getState();
    start('session-3', [
      makeExercise('e1', 0, [makeSet('e1-set-2', 2)]),
      makeExercise('e2', 1, [makeSet('e2-set-1', 0)]),
    ]);

    addSet('e1', makeSet('e1-set-1', 1));

    const [exerciseOne, exerciseTwo] =
      useActiveWorkoutStore.getState().exercises;
    expect(exerciseOne.sets.map((setItem) => setItem.id)).toEqual([
      'e1-set-1',
      'e1-set-2',
    ]);
    expect(exerciseTwo.sets.map((setItem) => setItem.id)).toEqual(['e2-set-1']);
  });

  it('updates sets and starts rest timer from the configured default when a set is marked completed', () => {
    const { start, setRestTimerDefault, updateSet } =
      useActiveWorkoutStore.getState();
    start('session-4', [
      makeExercise('e1', 0, [makeSet('e1-set-1', 0), makeSet('e1-set-2', 1)]),
      makeExercise('e2', 1),
    ]);
    setRestTimerDefault(150);

    updateSet('e1', 'e1-set-1', { reps: 10 });
    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(0);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(false);
    expect(useActiveWorkoutStore.getState().exercises[0]?.sets[0]?.reps).toBe(
      10,
    );
    expect(useActiveWorkoutStore.getState().exercises[0]?.sets[1]?.reps).toBe(
      8,
    );

    updateSet('e1', 'e1-set-1', { isCompleted: true });
    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(150);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(true);
    expect(useActiveWorkoutStore.getState().restTimerEndsAt).toBeTypeOf(
      'number',
    );
    expect(
      useActiveWorkoutStore.getState().exercises[0]?.sets[0]?.isCompleted,
    ).toBe(true);
    expect(
      useActiveWorkoutStore.getState().exercises[1]?.sets[0]?.isCompleted,
    ).toBe(false);

    updateSet('e1', 'e1-set-1', { isCompleted: false });
    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(0);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(false);
  });

  it('removes sets and updates superset keys', () => {
    const { start, removeSet, setSuperset } = useActiveWorkoutStore.getState();
    start('session-5', [
      makeExercise('e1', 0, [makeSet('e1-set-1', 0), makeSet('e1-set-2', 1)]),
      makeExercise('e2', 1, [makeSet('e2-set-1', 0)]),
    ]);

    removeSet('e1', 'e1-set-1');
    expect(
      useActiveWorkoutStore
        .getState()
        .exercises[0]?.sets.map((setItem) => setItem.id),
    ).toEqual(['e1-set-2']);
    expect(
      useActiveWorkoutStore
        .getState()
        .exercises[1]?.sets.map((setItem) => setItem.id),
    ).toEqual(['e2-set-1']);

    setSuperset('e1', 'A');
    expect(
      useActiveWorkoutStore.getState().exercises[0]?.supersetGroupKey,
    ).toBe('A');

    setSuperset('e1');
    expect(
      useActiveWorkoutStore.getState().exercises[0]?.supersetGroupKey,
    ).toBe(undefined);
  });

  it('handles rest timer transitions from an absolute end timestamp', () => {
    const { setRestTimer, tickRestTimer } = useActiveWorkoutStore.getState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'));

    tickRestTimer();
    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(0);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(false);

    setRestTimer(3);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(true);
    expect(useActiveWorkoutStore.getState().restTimerEndsAt).toBe(
      new Date('2026-03-06T12:00:03.000Z').getTime(),
    );

    vi.setSystemTime(new Date('2026-03-06T12:00:01.500Z'));
    tickRestTimer();
    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(2);

    setRestTimer(1);
    vi.setSystemTime(new Date('2026-03-06T12:00:03.100Z'));
    tickRestTimer();
    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(0);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(false);

    setRestTimer(0);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(false);
  });

  it('persists the configured rest timer default across workout starts', () => {
    const { setRestTimer, setRestTimerDefault, start } =
      useActiveWorkoutStore.getState();

    setRestTimer(45);
    setRestTimerDefault(120);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(true);

    start('session-6', [makeExercise('e1', 0)]);

    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(0);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(false);
    expect(useActiveWorkoutStore.getState().restTimerDefaultSeconds).toBe(120);
  });

  it('syncs server refreshes for the same session without resetting the rest timer', () => {
    const { setRestTimer, start, syncFromServer } =
      useActiveWorkoutStore.getState();

    start('session-7', [makeExercise('e1', 0)], {
      startedAt: '2026-03-06T12:00:00.000Z',
    });
    setRestTimer(45);

    syncFromServer(
      'session-7',
      [makeExercise('e1', 0), makeExercise('e2', 1)],
      {
        startedAt: '2026-03-06T12:00:00.000Z',
      },
    );

    expect(useActiveWorkoutStore.getState().restTimerSeconds).toBe(45);
    expect(useActiveWorkoutStore.getState().restTimerActive).toBe(true);
    expect(
      useActiveWorkoutStore.getState().exercises.map((item) => item.id),
    ).toEqual(['e1', 'e2']);
  });

  it('declares a persisted store version and migration handler', () => {
    const persistOptions = useActiveWorkoutStore.persist.getOptions() as {
      migrate?: (persistedState: unknown) => unknown;
      version?: number;
    };

    expect(persistOptions.version).toBe(1);
    expect(persistOptions.migrate).toBeTypeOf('function');
  });

  it('uses browser localStorage when available', async () => {
    vi.resetModules();
    const localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('window', { localStorage } as unknown as Window);

    const { useActiveWorkoutStore: browserStore } = await import(
      './activeWorkoutStore'
    );
    browserStore.getState().start('browser-session', [makeExercise('e1', 0)]);
    await browserStore.persist.clearStorage();

    expect(localStorage.setItem).toHaveBeenCalled();
    expect(localStorage.removeItem).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
