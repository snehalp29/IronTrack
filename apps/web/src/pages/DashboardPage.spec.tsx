import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findButtonByLabel } from '../testing/react-tree';
import { DashboardPage } from './DashboardPage';

const useEffectMock = vi.hoisted(() =>
  vi.fn((callback: () => void) => {
    callback();
  }),
);
const navigateMock = vi.hoisted(() => vi.fn());
const locationState = vi.hoisted(() => ({
  value: {
    state: null as unknown,
  },
}));
const useDashboardPageDataMock = vi.hoisted(() => vi.fn());
const clearWorkoutMock = vi.hoisted(() => vi.fn());

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: useEffectMock,
  };
});

vi.mock('react-router-dom', () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useLocation: () => locationState.value,
  useNavigate: () => navigateMock,
}));

vi.mock('../lib/web-data', () => ({
  useDashboardPageData: useDashboardPageDataMock,
}));

vi.mock('../stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: (
    selector: (state: { clear: () => void }) => unknown,
  ) =>
    selector({
      clear: clearWorkoutMock,
    }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationState.value = {
      state: null,
    };
    useDashboardPageDataMock.mockReturnValue({
      checklistCompleteCount: 3,
      checklistTotalCount: 4,
      errorMessage: undefined,
      nextTemplate: { id: 'tpl-42', name: 'Push Day A' },
      onStartNextWorkout: vi.fn(),
      workoutStreakDays: 5,
    });
  });

  it('does not clear workout state without a completion handoff flag', () => {
    renderToStaticMarkup(<DashboardPage />);

    expect(clearWorkoutMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('clears completed workout state after returning from the completion flow', () => {
    locationState.value = {
      state: {
        clearCompletedWorkout: true,
      },
    };

    renderToStaticMarkup(<DashboardPage />);

    expect(clearWorkoutMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/', {
      replace: true,
      state: null,
    });
  });

  it('starts the next workout directly from the dashboard start action', () => {
    const onStartNextWorkout = vi.fn();
    useDashboardPageDataMock.mockReturnValue({
      checklistCompleteCount: 3,
      checklistTotalCount: 4,
      errorMessage: undefined,
      nextTemplate: { id: 'tpl-42', name: 'Push Day A' },
      onStartNextWorkout,
      workoutStreakDays: 5,
    });

    const view = DashboardPage();
    const html = renderToStaticMarkup(view);

    expect(html).toContain('Preview');
    expect(html).toContain('Start');
    findButtonByLabel(view, 'Start')?.props.onClick?.();

    expect(onStartNextWorkout).toHaveBeenCalledTimes(1);
  });
});
