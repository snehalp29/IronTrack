import type { KeyboardEvent } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function focusInitialModalTarget(element: HTMLDivElement | null): void {
  if (!element) {
    return;
  }

  const focusableElements = getFocusableElements(element);
  (focusableElements[0] ?? element).focus();
}

export function handleModalKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  onClose: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableElements(event.currentTarget);
  if (focusableElements.length === 0) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }

  const activeElement =
    typeof document !== 'undefined' &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const currentIndex = activeElement
    ? focusableElements.indexOf(activeElement)
    : -1;
  const nextIndex = getTrappedFocusIndex(
    currentIndex,
    focusableElements.length,
    event.shiftKey,
  );

  event.preventDefault();
  focusableElements[nextIndex]?.focus();
}

export function getTrappedFocusIndex(
  currentIndex: number,
  total: number,
  shiftKey: boolean,
): number {
  if (total <= 0) {
    return -1;
  }

  if (currentIndex < 0 || currentIndex >= total) {
    return shiftKey ? total - 1 : 0;
  }

  if (shiftKey) {
    return currentIndex === 0 ? total - 1 : currentIndex - 1;
  }

  return currentIndex === total - 1 ? 0 : currentIndex + 1;
}

function getFocusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) => element.tabIndex >= 0 && !element.hasAttribute('disabled'),
  );
}
