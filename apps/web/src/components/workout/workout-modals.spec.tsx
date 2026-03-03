import {
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
} from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ExerciseOverflowModal } from './ExerciseOverflowModal';
import { IncompleteWarningModal } from './IncompleteWarningModal';
import { ReorderModal } from './ReorderModal';
import { SupersetModal } from './SupersetModal';

function findButtonByLabel(
  node: ReactNode,
  label: string,
): ReactElement<{ onClick?: () => void }> | undefined {
  if (!isValidElement(node)) {
    return undefined;
  }

  if (node.type === 'button' && node.props.children === label) {
    return node as ReactElement<{ onClick?: () => void }>;
  }

  const children = node.props.children as ReactNode;
  if (!children) {
    return undefined;
  }

  const queue = Array.isArray(children) ? children : [children];
  for (const child of queue) {
    const result = findButtonByLabel(child, label);
    if (result) {
      return result;
    }
  }

  return undefined;
}

function render(element: ReactElement): string {
  return renderToStaticMarkup(cloneElement(element));
}

describe('workout modals', () => {
  it('ExerciseOverflowModal returns null when closed and renders content when open', () => {
    expect(ExerciseOverflowModal({ open: false, onClose: vi.fn() })).toBeNull();

    const onClose = vi.fn();
    const view = ExerciseOverflowModal({ open: true, onClose });
    expect(view).not.toBeNull();
    expect(render(view as ReactElement)).toContain('Exercise Actions');

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
    expect(render(view as ReactElement)).toContain('Incomplete Workout');

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
    expect(render(view as ReactElement)).toContain('Reorder Exercises');

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
    expect(render(view as ReactElement)).toContain('Superset Builder');

    const applyButton = findButtonByLabel(view, 'Apply');
    expect(applyButton).toBeDefined();
    applyButton?.props.onClick?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
