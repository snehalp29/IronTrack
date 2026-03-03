import { type ReactElement, type ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findButtonByLabel } from '../testing/react-tree';
import { CompletionMotivationPage } from './CompletionMotivationPage';
import { CompletionNextPage } from './CompletionNextPage';
import { CompletionProgressPage } from './CompletionProgressPage';
import { CompletionStreakPage } from './CompletionStreakPage';
import { CompletionSummaryPage } from './CompletionSummaryPage';
import { DashboardPage } from './DashboardPage';
import { ExerciseSelectPage } from './ExerciseSelectPage';
import { HistoryPage } from './HistoryPage';
import { NotFoundPage } from './NotFoundPage';
import { SettingsPage } from './SettingsPage';
import { WorkoutPreviewPage } from './WorkoutPreviewPage';

const useActiveWorkoutStoreMock = vi.hoisted(() => vi.fn());
const clearMock = vi.hoisted(() => vi.fn());
const summaryState = vi.hoisted(() => ({
  value: undefined as
    | {
        totalVolume: number;
        durationSeconds: number;
        prs: number;
      }
    | undefined,
}));

vi.mock('react-router-dom', () => ({
  Link: ({
    to,
    children,
    className,
    style,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    style?: Record<string, unknown>;
  }) => (
    <a href={to} className={className} style={style}>
      {children}
    </a>
  ),
  useParams: () => ({ templateId: 'tpl-42' }),
}));

vi.mock('../stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: useActiveWorkoutStoreMock,
}));

function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

describe('static/simple pages', () => {
  beforeEach(() => {
    clearMock.mockReset();
    summaryState.value = undefined;
    useActiveWorkoutStoreMock.mockImplementation(
      (
        selector: (state: {
          clear: () => void;
          completeSummary:
            | {
                totalVolume: number;
                durationSeconds: number;
                prs: number;
              }
            | undefined;
        }) => unknown,
      ) =>
        selector({
          clear: clearMock,
          completeSummary: summaryState.value,
        }),
    );
  });

  it('renders dashboard links', () => {
    const html = render(<DashboardPage />);
    expect(html).toContain('Today Overview');
    expect(html).toContain('Next Workout');
    expect(html).toContain('href="/workout/active"');
    expect(html).toContain('href="/workout/123/preview"');
  });

  it('renders history entries', () => {
    const html = render(<HistoryPage />);
    expect(html).toContain('Workout History');
    expect(html).toContain('Push Day A');
    expect(html).toContain('Pull Day A');
    expect(html).toContain('Leg Day A');
  });

  it('renders exercise selection list and create link', () => {
    const html = render(<ExerciseSelectPage />);
    expect(html).toContain('Select Exercise');
    expect(html).toContain('Barbell Bench Press');
    expect(html).toContain('Pull-Up');
    expect(html).toContain('Barbell Back Squat');
    expect(html).toContain('href="/exercise/create"');
  });

  it('renders workout preview with route params', () => {
    const html = render(<WorkoutPreviewPage />);
    expect(html).toContain('Workout Preview');
    expect(html).toContain('Template ID: tpl-42');
    expect(html).toContain('href="/workout/active"');
  });

  it('renders not-found view', () => {
    const html = render(<NotFoundPage />);
    expect(html).toContain('Not Found');
    expect(html).toContain('The page does not exist.');
    expect(html).toContain('href="/"');
  });

  it('renders settings controls', () => {
    const html = render(<SettingsPage />);
    expect(html).toContain('Settings');
    expect(html).toContain('America/New_York');
    expect(html).toContain('Metric (kg)');
    expect(html).toContain('Delete Account');
  });

  it('renders completion step navigation', () => {
    expect(render(<CompletionMotivationPage />)).toContain(
      'href="/workout/complete/summary"',
    );
    expect(render(<CompletionSummaryPage />)).toContain(
      'href="/workout/complete/progress"',
    );
    expect(render(<CompletionProgressPage />)).toContain(
      'href="/workout/complete/next"',
    );
    expect(render(<CompletionNextPage />)).toContain(
      'href="/workout/complete/streak"',
    );
  });

  it('renders summary fallbacks and provided values', () => {
    const fallbackHtml = render(<CompletionSummaryPage />);
    expect(fallbackHtml).toContain('Volume: 0');
    expect(fallbackHtml).toContain('Duration: 0s');
    expect(fallbackHtml).toContain('PRs: 0');

    summaryState.value = {
      totalVolume: 9999,
      durationSeconds: 1234,
      prs: 3,
    };
    const valueHtml = render(<CompletionSummaryPage />);
    expect(valueHtml).toContain('Volume: 9999');
    expect(valueHtml).toContain('Duration: 1234s');
    expect(valueHtml).toContain('PRs: 3');
  });

  it('calls clear from completion streak page', () => {
    const view = CompletionStreakPage();
    const button = findButtonByLabel(view, 'Back to Dashboard');
    expect(button).toBeDefined();

    button?.props.onClick?.();
    expect(clearMock).toHaveBeenCalledTimes(1);
  });
});
