import { type ReactElement, cloneElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { findButtonByLabel } from '../../testing/react-tree';
import { ExerciseOverflowModal } from './ExerciseOverflowModal';
import { IncompleteWarningModal } from './IncompleteWarningModal';
import { ReorderModal } from './ReorderModal';
import { SupersetModal } from './SupersetModal';

function render(element: ReactElement): string {
  return renderToStaticMarkup(cloneElement(element));
}

describe('workout modals', () => {
  it('ExerciseOverflowModal returns null when closed and renders content when open', () => {
    expect(ExerciseOverflowModal({ open: false, onClose: vi.fn() })).toBeNull();

    const onClose = vi.fn();
    const view = ExerciseOverflowModal({ open: true, onClose });
    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Exercise Actions');
    expect(html).toContain('class="card modal modal--accent"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="exercise-overflow-title"');
    expect(html).toContain('class="danger"');

    const closeButton = findButtonByLabel(view, 'Close');
    expect(closeButton).toBeDefined();
    closeButton?.props.onClick?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('IncompleteWarningModal returns null when closed and wires confirm/close callbacks', () => {
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
    expect(html).toContain('class="card modal modal--warning"');
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="incomplete-warning-title"');
    expect(html).toContain('aria-describedby="incomplete-warning-description"');
    expect(html).toContain('class="modal__actions"');
    expect(html).toContain('class="danger"');

    const confirmButton = findButtonByLabel(view, 'Finish Anyway');
    const continueButton = findButtonByLabel(view, 'Continue Workout');
    expect(confirmButton).toBeDefined();
    expect(continueButton).toBeDefined();

    confirmButton?.props.onClick?.();
    continueButton?.props.onClick?.();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ReorderModal returns null when closed and calls close when done button clicked', () => {
    expect(ReorderModal({ open: false, onClose: vi.fn() })).toBeNull();

    const onClose = vi.fn();
    const view = ReorderModal({ open: true, onClose });
    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Reorder Exercises');
    expect(html).toContain('class="card modal modal--accent"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="reorder-modal-title"');

    const doneButton = findButtonByLabel(view, 'Done');
    expect(doneButton).toBeDefined();
    doneButton?.props.onClick?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('SupersetModal returns null when closed and calls close when apply button clicked', () => {
    expect(SupersetModal({ open: false, onClose: vi.fn() })).toBeNull();

    const onClose = vi.fn();
    const view = SupersetModal({ open: true, onClose });
    expect(view).not.toBeNull();
    const html = render(view as ReactElement);
    expect(html).toContain('Superset Builder');
    expect(html).toContain('class="card modal modal--accent"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="superset-modal-title"');

    const applyButton = findButtonByLabel(view, 'Apply');
    expect(applyButton).toBeDefined();
    applyButton?.props.onClick?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
