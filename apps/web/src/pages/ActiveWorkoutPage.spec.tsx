import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findButtonByLabel,
  findButtonsByTextIncludes,
} from '../testing/react-tree';
import { ActiveWorkoutPage } from './ActiveWorkoutPage';

const useStateMock = vi.hoisted(() => vi.fn());
const useMemoMock = vi.hoisted(() => vi.fn());
const useNavigateMock = vi.hoisted(() => vi.fn());
const useRestTimerMock = vi.hoisted(() => vi.fn());
const useActiveWorkoutStoreMock = vi.hoisted(() => vi.fn());

type SimpleModalProps = {
  open: boolean;
  onClose: () => void;
};

type IncompleteModalProps = SimpleModalProps & {
  onConfirm: () => void;
};

const overflowModalMock = vi.hoisted(() =>
  vi.fn((props: SimpleModalProps) => (
    <div data-modal="overflow" data-open={String(props.open)} />
  )),
);
const reorderModalMock = vi.hoisted(() =>
  vi.fn((props: SimpleModalProps) => (
    <div data-modal="reorder" data-open={String(props.open)} />
  )),
);
const supersetModalMock = vi.hoisted(() =>
  vi.fn((props: SimpleModalProps) => (
    <div data-modal="superset" data-open={String(props.open)} />
  )),
);
const incompleteModalMock = vi.hoisted(() =>
  vi.fn((props: IncompleteModalProps) => (
    <div data-modal="incomplete" data-open={String(props.open)} />
  )),
);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: useStateMock,
    useMemo: useMemoMock,
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: useNavigateMock,
}));

vi.mock('../hooks/useRestTimer', () => ({
  useRestTimer: useRestTimerMock,
}));

vi.mock('../stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: useActiveWorkoutStoreMock,
}));

vi.mock('../components/workout/ExerciseOverflowModal', () => ({
  ExerciseOverflowModal: overflowModalMock,
}));

vi.mock('../components/workout/ReorderModal', () => ({
  ReorderModal: reorderModalMock,
}));

vi.mock('../components/workout/SupersetModal', () => ({
  SupersetModal: supersetModalMock,
}));

vi.mock('../components/workout/IncompleteWarningModal', () => ({
  IncompleteWarningModal: incompleteModalMock,
}));

type StoreState = {
  state: 'IDLE' | 'IN_PROGRESS' | 'COMPLETED';
  start: (sessionId: string, exercises: unknown[]) => void;
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{
      id: string;
      orderIndex: number;
      weight: number;
      reps: number;
      isCompleted: boolean;
    }>;
  }>;
  updateSet: (
    exerciseId: string,
    setId: string,
    patch: { isCompleted: boolean },
  ) => void;
  finish: (summary: {
    totalVolume: number;
    durationSeconds: number;
    prs: number;
  }) => void;
  restTimerSeconds: number;
};

describe('ActiveWorkoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMemoMock.mockImplementation((factory: () => unknown) => factory());
  });

  it('renders idle state and starts seeded session', () => {
    const navigate = vi.fn();
    const start = vi.fn();
    const updateSet = vi.fn();
    const finish = vi.fn();
    const store: StoreState = {
      state: 'IDLE',
      start,
      exercises: [],
      updateSet,
      finish,
      restTimerSeconds: 0,
    };

    useNavigateMock.mockReturnValue(navigate);
    useActiveWorkoutStoreMock.mockImplementation(
      (selector: (state: StoreState) => unknown) => selector(store),
    );

    const setOverflow = vi.fn();
    const setReorder = vi.fn();
    const setSuperset = vi.fn();
    const setIncomplete = vi.fn();
    useStateMock
      .mockReturnValueOnce([false, setOverflow])
      .mockReturnValueOnce([false, setReorder])
      .mockReturnValueOnce([false, setSuperset])
      .mockReturnValueOnce([false, setIncomplete]);

    const view = ActiveWorkoutPage();
    const html = renderToStaticMarkup(view);
    expect(html).toContain('No active session');
    expect(useRestTimerMock).toHaveBeenCalledTimes(1);

    findButtonByLabel(view, 'Start Session')?.props.onClick?.();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      'session-local-1',
      expect.arrayContaining([
        expect.objectContaining({ id: 'se-1' }),
        expect.objectContaining({ id: 'se-2' }),
      ]),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('handles in-progress actions and incomplete finish flow', () => {
    const navigate = vi.fn();
    const start = vi.fn();
    const updateSet = vi.fn();
    const finish = vi.fn();
    const store: StoreState = {
      state: 'IN_PROGRESS',
      start,
      exercises: [
        {
          id: 'ex-1',
          name: 'Bench',
          sets: [
            {
              id: 'set-1',
              orderIndex: 0,
              weight: 100,
              reps: 8,
              isCompleted: false,
            },
            {
              id: 'set-2',
              orderIndex: 1,
              weight: 100,
              reps: 8,
              isCompleted: true,
            },
          ],
        },
      ],
      updateSet,
      finish,
      restTimerSeconds: 45,
    };

    useNavigateMock.mockReturnValue(navigate);
    useActiveWorkoutStoreMock.mockImplementation(
      (selector: (state: StoreState) => unknown) => selector(store),
    );

    const setOverflow = vi.fn();
    const setReorder = vi.fn();
    const setSuperset = vi.fn();
    const setIncomplete = vi.fn();
    useStateMock
      .mockReturnValueOnce([false, setOverflow])
      .mockReturnValueOnce([false, setReorder])
      .mockReturnValueOnce([false, setSuperset])
      .mockReturnValueOnce([false, setIncomplete]);

    const view = ActiveWorkoutPage();
    const html = renderToStaticMarkup(view);
    expect(html).toContain('Completed sets: 1 / 2');
    expect(html).toContain('Rest Timer: 45s');

    findButtonByLabel(view, 'Overflow')?.props.onClick?.();
    findButtonByLabel(view, 'Reorder')?.props.onClick?.();
    findButtonByLabel(view, 'Superset')?.props.onClick?.();
    expect(setOverflow).toHaveBeenCalledWith(true);
    expect(setReorder).toHaveBeenCalledWith(true);
    expect(setSuperset).toHaveBeenCalledWith(true);

    const setButtons = findButtonsByTextIncludes(view, 'Set ');
    expect(setButtons).toHaveLength(2);
    setButtons[0]?.props.onClick?.();
    setButtons[1]?.props.onClick?.();
    expect(updateSet).toHaveBeenNthCalledWith(1, 'ex-1', 'set-1', {
      isCompleted: true,
    });
    expect(updateSet).toHaveBeenNthCalledWith(2, 'ex-1', 'set-2', {
      isCompleted: false,
    });

    findButtonByLabel(view, 'Finish Workout')?.props.onClick?.();
    expect(setIncomplete).toHaveBeenCalledWith(true);
    expect(finish).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    const overflowProps = overflowModalMock.mock.calls[0]?.[0];
    const reorderProps = reorderModalMock.mock.calls[0]?.[0];
    const supersetProps = supersetModalMock.mock.calls[0]?.[0];
    const incompleteProps = incompleteModalMock.mock.calls[0]?.[0];

    expect(overflowProps?.open).toBe(false);
    expect(reorderProps?.open).toBe(false);
    expect(supersetProps?.open).toBe(false);
    expect(incompleteProps?.open).toBe(false);

    overflowProps?.onClose();
    reorderProps?.onClose();
    supersetProps?.onClose();
    incompleteProps?.onClose();
    expect(setOverflow).toHaveBeenCalledWith(false);
    expect(setReorder).toHaveBeenCalledWith(false);
    expect(setSuperset).toHaveBeenCalledWith(false);
    expect(setIncomplete).toHaveBeenCalledWith(false);
  });

  it('finalizes completed workouts from finish button and warning confirm action', () => {
    const navigate = vi.fn();
    const start = vi.fn();
    const updateSet = vi.fn();
    const finish = vi.fn();
    const store: StoreState = {
      state: 'IN_PROGRESS',
      start,
      exercises: [
        {
          id: 'ex-2',
          name: 'Incline Press',
          sets: [
            {
              id: 'set-3',
              orderIndex: 0,
              weight: 80,
              reps: 10,
              isCompleted: true,
            },
          ],
        },
      ],
      updateSet,
      finish,
      restTimerSeconds: 0,
    };

    useNavigateMock.mockReturnValue(navigate);
    useActiveWorkoutStoreMock.mockImplementation(
      (selector: (state: StoreState) => unknown) => selector(store),
    );

    const setOverflow = vi.fn();
    const setReorder = vi.fn();
    const setSuperset = vi.fn();
    const setIncomplete = vi.fn();
    useStateMock
      .mockReturnValueOnce([true, setOverflow])
      .mockReturnValueOnce([true, setReorder])
      .mockReturnValueOnce([true, setSuperset])
      .mockReturnValueOnce([true, setIncomplete]);

    const view = ActiveWorkoutPage();
    renderToStaticMarkup(view);
    findButtonByLabel(view, 'Finish Workout')?.props.onClick?.();
    expect(finish).toHaveBeenCalledWith({
      totalVolume: 12450,
      durationSeconds: 3120,
      prs: 2,
    });
    expect(setIncomplete).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith('/workout/complete');

    const incompleteProps = incompleteModalMock.mock.calls[0]?.[0];
    expect(incompleteProps?.open).toBe(true);

    incompleteProps?.onConfirm();
    expect(finish).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
