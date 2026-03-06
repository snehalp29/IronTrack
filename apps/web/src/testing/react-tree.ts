import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';

type ElementProps = Record<string, unknown>;

export type ElementWithProps = ReactElement<ElementProps>;
export type ClickableElement = ReactElement<{
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}>;
export type FormElement = ReactElement<{
  onSubmit?: (event?: { preventDefault?: () => void }) => void;
}>;

function toNodeArray(value: unknown): ReactNode[] {
  if (value === undefined || value === null || value === false) {
    return [];
  }

  return Array.isArray(value) ? (value as ReactNode[]) : [value as ReactNode];
}

function toElement(node: ReactNode): ElementWithProps | undefined {
  if (!isValidElement(node)) {
    return undefined;
  }

  return node as ElementWithProps;
}

export function nodeText(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => nodeText(item)).join('');
  }

  const element = toElement(value);
  if (!element) {
    return '';
  }

  return nodeText((element.props.children ?? null) as ReactNode);
}

export function findElement(
  node: ReactNode,
  predicate: (element: ElementWithProps) => boolean,
): ElementWithProps | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const nested = findElement(child, predicate);
      if (nested) {
        return nested;
      }
    }
    return undefined;
  }

  const element = toElement(node);
  if (!element) {
    return undefined;
  }

  if (predicate(element)) {
    return element;
  }

  for (const child of toNodeArray(element.props.children)) {
    const nested = findElement(child, predicate);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

export function findAllElements(
  node: ReactNode,
  predicate: (element: ElementWithProps) => boolean,
): ElementWithProps[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findAllElements(child, predicate));
  }

  const element = toElement(node);
  if (!element) {
    return [];
  }

  const results: ElementWithProps[] = [];
  if (predicate(element)) {
    results.push(element);
  }

  for (const child of toNodeArray(element.props.children)) {
    results.push(...findAllElements(child, predicate));
  }

  return results;
}

function asClickable(element: ElementWithProps): ClickableElement {
  return element as unknown as ClickableElement;
}

function findButton(
  node: ReactNode,
  label: string,
  match: 'exact' | 'includes',
): ClickableElement | undefined {
  const found = findElement(node, (element) => {
    if (element.type !== 'button') {
      return false;
    }

    const text = nodeText((element.props.children ?? null) as ReactNode);
    return match === 'exact' ? text === label : text.includes(label);
  });

  return found ? asClickable(found) : undefined;
}

export function findButtonByLabel(
  node: ReactNode,
  label: string,
): ClickableElement | undefined {
  return findButton(node, label, 'exact');
}

export function findButtonByTextIncludes(
  node: ReactNode,
  labelFragment: string,
): ClickableElement | undefined {
  return findButton(node, labelFragment, 'includes');
}

export function findButtonsByTextIncludes(
  node: ReactNode,
  labelFragment: string,
): ClickableElement[] {
  return findAllElements(
    node,
    (element) =>
      element.type === 'button' &&
      nodeText((element.props.children ?? null) as ReactNode).includes(
        labelFragment,
      ),
  ).map(asClickable);
}

export function findForm(node: ReactNode): FormElement | undefined {
  const found = findElement(node, (element) => element.type === 'form');
  return found ? (found as unknown as FormElement) : undefined;
}
