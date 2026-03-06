import { type ReactElement, cloneElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  findButtonByLabel,
  findButtonsByTextIncludes,
  findElement,
} from '../../testing/react-tree';
import { ExerciseNotesModal } from './ExerciseNotesModal';
import { ExerciseOverflowModal } from './ExerciseOverflowModal';
import { IncompleteWarningModal } from './IncompleteWarningModal';
import { ReorderModal } from './ReorderModal';
import { SupersetModal } from './SupersetModal';

function render(element: ReactElement): string {
  return renderToStaticMarkup(cloneElement(element));
}

describe('workout modals', () => {
  it('ExerciseOverflowModal renders actionable controls and close semantics', () => {
    expect(
      ExerciseOverflowModal({
        open: false,
        exerciseName: undefined,
        onClose: vi.fn(),
        onEditNotes: vi.fn(),
        onSwapExercise: vi.fn(),
        onDeleteExercise: vi.fn(),
      }),
    ).toBeNull();

    const onClose = vi.fn();
    const onEditNotes = vi.fn();
    const onSwapExercise = vi.fn();
    const onDeleteExercise = vi.fn();
    const view = ExerciseOverflowModal({
      open: true,
      exerciseName: 'Bench Press',
      onClose,
      onEditNotes,
      onSwapExercise,
      onDeleteExercise,
    });
    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Exercise Actions');
    expect(html).toContain('Bench Press');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('tabindex="-1"');

    findButtonByLabel(view, 'Edit Notes')?.props.onClick?.();
    findButtonByLabel(view, 'Swap Exercise')?.props.onClick?.();
    findButtonByLabel(view, 'Delete Exercise')?.props.onClick?.();
    findButtonByLabel(view, 'Close')?.props.onClick?.();

    expect(onEditNotes).toHaveBeenCalledTimes(1);
    expect(onSwapExercise).toHaveBeenCalledTimes(1);
    expect(onDeleteExercise).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      findElement(view, (element) => element.props.onKeyDown !== undefined),
    ).toBeDefined();
  });

  it('IncompleteWarningModal renders warning actions and accessibility metadata', () => {
    expect(
      IncompleteWarningModal({
        open: false,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      }),
    ).toBeNull();

    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const view = IncompleteWarningModal({
      open: true,
      onClose,
      onConfirm,
    });
    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Incomplete Workout');
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-describedby="incomplete-warning-description"');
    expect(html).toContain('tabindex="-1"');

    findButtonByLabel(view, 'Finish Anyway')?.props.onClick?.();
    findButtonByLabel(view, 'Continue Workout')?.props.onClick?.();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ReorderModal lets the caller move items and apply the new order', () => {
    expect(
      ReorderModal({
        open: false,
        exercises: [],
        onClose: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onApply: vi.fn(),
      }),
    ).toBeNull();

    const onClose = vi.fn();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const onApply = vi.fn();
    const view = ReorderModal({
      open: true,
      exercises: [
        { id: 'se-1', name: 'Bench Press', orderIndex: 0 },
        { id: 'se-2', name: 'Incline Press', orderIndex: 1 },
      ],
      onClose,
      onMoveUp,
      onMoveDown,
      onApply,
    });
    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Reorder Exercises');
    expect(html).toContain('Bench Press');
    expect(html).toContain('Incline Press');

    const moveButtons = findButtonsByTextIncludes(view, 'Move ');
    expect(moveButtons).toHaveLength(4);
    moveButtons[0]?.props.onClick?.();
    moveButtons[3]?.props.onClick?.();
    findButtonByLabel(view, 'Apply Order')?.props.onClick?.();
    findButtonByLabel(view, 'Cancel')?.props.onClick?.();

    expect(onMoveUp).toHaveBeenCalledWith('se-1');
    expect(onMoveDown).toHaveBeenCalledWith('se-2');
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('SupersetModal lets the caller select exercises and apply the grouping', () => {
    expect(
      SupersetModal({
        open: false,
        exercises: [],
        selectedExerciseIds: [],
        onClose: vi.fn(),
        onToggleExercise: vi.fn(),
        onApply: vi.fn(),
      }),
    ).toBeNull();

    const onClose = vi.fn();
    const onToggleExercise = vi.fn();
    const onApply = vi.fn();
    const view = SupersetModal({
      open: true,
      exercises: [
        { id: 'se-1', name: 'Bench Press' },
        { id: 'se-2', name: 'Rows' },
      ],
      selectedExerciseIds: ['se-1'],
      onClose,
      onToggleExercise,
      onApply,
    });
    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Superset Builder');
    expect(html).toContain('Bench Press');
    expect(html).toContain('Rows');

    const toggleButtons = findButtonsByTextIncludes(view, 'Select ');
    expect(toggleButtons).toHaveLength(2);
    toggleButtons[0]?.props.onClick?.();
    findButtonByLabel(view, 'Apply Superset')?.props.onClick?.();
    findButtonByLabel(view, 'Cancel')?.props.onClick?.();

    expect(onToggleExercise).toHaveBeenCalledWith('se-1');
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ExerciseNotesModal renders editable notes with save and close actions', () => {
    expect(
      ExerciseNotesModal({
        open: false,
        exerciseName: undefined,
        errorMessage: undefined,
        isSaving: false,
        notes: '',
        onChange: vi.fn(),
        onClose: vi.fn(),
        onSave: vi.fn(),
      }),
    ).toBeNull();

    const onChange = vi.fn();
    const onClose = vi.fn();
    const onSave = vi.fn();
    const view = ExerciseNotesModal({
      open: true,
      exerciseName: 'Bench Press',
      errorMessage: 'Failed to save notes',
      isSaving: false,
      notes: 'Keep elbows tucked',
      onChange,
      onClose,
      onSave,
    });

    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Edit Exercise Notes');
    expect(html).toContain('Bench Press');
    expect(html).toContain('Failed to save notes');
    expect(html).toContain('Keep elbows tucked');

    const textarea = findElement(
      view,
      (element) => element.type === 'textarea',
    );
    const onTextareaChange = textarea?.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    onTextareaChange?.({
      target: {
        value: 'Drive through the bar',
      },
    });
    findButtonByLabel(view, 'Save Notes')?.props.onClick?.();
    findButtonByLabel(view, 'Cancel')?.props.onClick?.();

    expect(onChange).toHaveBeenCalledWith('Drive through the bar');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
