import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findButtonByLabel,
  findButtonsByTextIncludes,
} from '../testing/react-tree';
import { ActiveWorkoutPage } from './ActiveWorkoutPage';

const useActiveWorkoutPageDataMock = vi.hoisted(() => vi.fn());

type SimpleModalProps = {
  open: boolean;
  onClose: () => void;
};

type OverflowModalProps = SimpleModalProps & {
  exerciseName?: string;
  onDeleteExercise: () => void;
  onEditNotes: () => void;
  onSwapExercise: () => void;
};

type ReorderModalProps = SimpleModalProps & {
  exercises: Array<{ id: string; name: string; orderIndex: number }>;
  onApply: () => void;
  onMoveDown: (exerciseId: string) => void;
  onMoveUp: (exerciseId: string) => void;
};

type SupersetModalProps = SimpleModalProps & {
  exercises: Array<{ id: string; name: string }>;
  onApply: () => void;
  onToggleExercise: (exerciseId: string) => void;
  selectedExerciseIds: string[];
};

type IncompleteModalProps = SimpleModalProps & {
  onConfirm: () => void;
};

type NotesModalProps = SimpleModalProps & {
  exerciseName?: string;
  errorMessage?: string;
  isSaving: boolean;
  notes: string;
  onChange: (value: string) => void;
  onSave: () => void;
};

const overflowModalMock = vi.hoisted(() =>
  vi.fn((props: OverflowModalProps) => (
    <div data-modal="overflow" data-open={String(props.open)} />
  )),
);
const reorderModalMock = vi.hoisted(() =>
  vi.fn((props: ReorderModalProps) => (
    <div data-modal="reorder" data-open={String(props.open)} />
  )),
);
const supersetModalMock = vi.hoisted(() =>
  vi.fn((props: SupersetModalProps) => (
    <div data-modal="superset" data-open={String(props.open)} />
  )),
);
const incompleteModalMock = vi.hoisted(() =>
  vi.fn((props: IncompleteModalProps) => (
    <div data-modal="incomplete" data-open={String(props.open)} />
  )),
);
const notesModalMock = vi.hoisted(() =>
  vi.fn((props: NotesModalProps) => (
    <div data-modal="notes" data-open={String(props.open)} />
  )),
);

vi.mock('../lib/web-data', () => ({
  useActiveWorkoutPageData: useActiveWorkoutPageDataMock,
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

vi.mock('../components/workout/ExerciseNotesModal', () => ({
  ExerciseNotesModal: notesModalMock,
}));

describe('ActiveWorkoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty active-session state from controller data', () => {
    const startWorkout = vi.fn();
    useActiveWorkoutPageDataMock.mockReturnValue({
      state: 'IDLE',
      exercises: [],
      totals: { completed: 0, total: 0 },
      restTimerSeconds: 0,
      errorMessage: undefined,
      idleActionLabel: 'Choose Workout',
      onIdleAction: startWorkout,
      onFinishWorkout: vi.fn(),
      onToggleSet: vi.fn(),
      overflow: {
        open: false,
        exerciseName: undefined,
        onClose: vi.fn(),
        onEditNotes: vi.fn(),
        onSwapExercise: vi.fn(),
        onDeleteExercise: vi.fn(),
      },
      reorder: {
        open: false,
        exercises: [],
        onClose: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onApply: vi.fn(),
      },
      superset: {
        open: false,
        exercises: [],
        selectedExerciseIds: [],
        onClose: vi.fn(),
        onToggleExercise: vi.fn(),
        onApply: vi.fn(),
      },
      incomplete: {
        open: false,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      },
      notes: {
        open: false,
        exerciseName: undefined,
        errorMessage: undefined,
        isSaving: false,
        notes: '',
        onChange: vi.fn(),
        onClose: vi.fn(),
        onSave: vi.fn(),
      },
      openOverflow: vi.fn(),
      openReorder: vi.fn(),
      openSuperset: vi.fn(),
    });

    const view = ActiveWorkoutPage();
    const html = renderToStaticMarkup(view);
    expect(html).toContain('No active session');

    findButtonByLabel(view, 'Choose Workout')?.props.onClick?.();
    expect(startWorkout).toHaveBeenCalledTimes(1);
  });

  it('renders real exercises and delegates active workout actions to the controller', () => {
    const onToggleSet = vi.fn();
    const openOverflow = vi.fn();
    const openReorder = vi.fn();
    const openSuperset = vi.fn();
    const onFinishWorkout = vi.fn();

    useActiveWorkoutPageDataMock.mockReturnValue({
      state: 'IN_PROGRESS',
      exercises: [
        {
          id: 'se-1',
          name: 'Bench Press',
          orderIndex: 0,
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
      totals: { completed: 1, total: 2 },
      restTimerSeconds: 45,
      errorMessage: 'Session sync failed',
      idleActionLabel: 'Choose Workout',
      onIdleAction: vi.fn(),
      onFinishWorkout,
      onToggleSet,
      overflow: {
        open: true,
        exerciseName: 'Bench Press',
        onClose: vi.fn(),
        onEditNotes: vi.fn(),
        onSwapExercise: vi.fn(),
        onDeleteExercise: vi.fn(),
      },
      reorder: {
        open: true,
        exercises: [{ id: 'se-1', name: 'Bench Press', orderIndex: 0 }],
        onClose: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onApply: vi.fn(),
      },
      superset: {
        open: true,
        exercises: [{ id: 'se-1', name: 'Bench Press' }],
        selectedExerciseIds: ['se-1'],
        onClose: vi.fn(),
        onToggleExercise: vi.fn(),
        onApply: vi.fn(),
      },
      incomplete: {
        open: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      },
      notes: {
        open: true,
        exerciseName: 'Bench Press',
        errorMessage: undefined,
        isSaving: false,
        notes: 'Keep elbows tucked',
        onChange: vi.fn(),
        onClose: vi.fn(),
        onSave: vi.fn(),
      },
      openOverflow,
      openReorder,
      openSuperset,
    });

    const view = ActiveWorkoutPage();
    const html = renderToStaticMarkup(view);
    expect(html).toContain('Completed sets: 1 / 2');
    expect(html).toContain('Rest Timer: 45s');
    expect(html).toContain('Session sync failed');
    expect(html).toContain('Bench Press');

    findButtonByLabel(view, 'Overflow')?.props.onClick?.();
    findButtonByLabel(view, 'Reorder')?.props.onClick?.();
    findButtonByLabel(view, 'Superset')?.props.onClick?.();
    findButtonByLabel(view, 'Finish Workout')?.props.onClick?.();

    expect(openOverflow).toHaveBeenCalledTimes(1);
    expect(openReorder).toHaveBeenCalledTimes(1);
    expect(openSuperset).toHaveBeenCalledTimes(1);
    expect(onFinishWorkout).toHaveBeenCalledTimes(1);

    const setButtons = findButtonsByTextIncludes(view, 'Set ');
    expect(setButtons).toHaveLength(2);
    setButtons[0]?.props.onClick?.();
    setButtons[1]?.props.onClick?.();
    expect(onToggleSet).toHaveBeenNthCalledWith(1, 'se-1', 'set-1', true);
    expect(onToggleSet).toHaveBeenNthCalledWith(2, 'se-1', 'set-2', false);

    expect(overflowModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        exerciseName: 'Bench Press',
      }),
      undefined,
    );
    expect(reorderModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        exercises: [{ id: 'se-1', name: 'Bench Press', orderIndex: 0 }],
      }),
      undefined,
    );
    expect(supersetModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        selectedExerciseIds: ['se-1'],
      }),
      undefined,
    );
    expect(incompleteModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
      }),
      undefined,
    );
    expect(notesModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        exerciseName: 'Bench Press',
        notes: 'Keep elbows tucked',
      }),
      undefined,
    );
  });
});
