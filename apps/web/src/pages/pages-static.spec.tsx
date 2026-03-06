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

const useDashboardPageDataMock = vi.hoisted(() => vi.fn());
const useHistoryPageDataMock = vi.hoisted(() => vi.fn());
const useSettingsPageDataMock = vi.hoisted(() => vi.fn());
const useWorkoutPreviewPageDataMock = vi.hoisted(() => vi.fn());
const useExerciseSelectPageDataMock = vi.hoisted(() => vi.fn());
const useCompletionFlowDataMock = vi.hoisted(() => vi.fn());
const useActiveWorkoutStoreMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const useBeforeUnloadMock = vi.hoisted(() => vi.fn());
const usePromptMock = vi.hoisted(() => vi.fn());
const routeParamsState = vi.hoisted(() => ({
  value: { templateId: 'tpl-42' } as { templateId?: string },
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
  useNavigate: () => navigateMock,
  unstable_usePrompt: usePromptMock,
  useBeforeUnload: useBeforeUnloadMock,
  useParams: () => routeParamsState.value,
}));

vi.mock('../lib/web-data', () => ({
  useCompletionFlowData: useCompletionFlowDataMock,
  useDashboardPageData: useDashboardPageDataMock,
  useExerciseSelectPageData: useExerciseSelectPageDataMock,
  useHistoryPageData: useHistoryPageDataMock,
  useSettingsPageData: useSettingsPageDataMock,
  useWorkoutPreviewPageData: useWorkoutPreviewPageDataMock,
}));

vi.mock('../stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: useActiveWorkoutStoreMock,
}));

function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

describe('static/simple pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParamsState.value = { templateId: 'tpl-42' };

    useDashboardPageDataMock.mockReturnValue({
      isLoading: false,
      errorMessage: undefined,
      checklistCompleteCount: 3,
      checklistTotalCount: 4,
      nextTemplate: { id: 'tpl-42', name: 'Push Day A' },
      workoutStreakDays: 5,
    });
    useHistoryPageDataMock.mockReturnValue({
      isLoading: false,
      errorMessage: undefined,
      items: [
        {
          id: 'session-1',
          startedAt: '2026-02-27T12:00:00.000Z',
          templateName: 'Push Day A',
          durationLabel: '52m',
          volumeLabel: '12,450',
        },
      ],
    });
    useSettingsPageDataMock.mockReturnValue({
      errorMessage: undefined,
      isDirty: false,
      isSaving: false,
      name: 'Iron Lifter',
      timezone: 'America/New_York',
      unitPreference: 'METRIC',
      restTimerDefaultSeconds: '120',
      timezones: ['UTC', 'America/New_York', 'Asia/Kolkata'],
      onDeleteAccount: vi.fn(),
      onLogout: vi.fn(),
      onNameChange: vi.fn(),
      onRestTimerDefaultSecondsChange: vi.fn(),
      onSave: vi.fn(),
      onTimezoneChange: vi.fn(),
      onUnitPreferenceChange: vi.fn(),
    });
    useWorkoutPreviewPageDataMock.mockReturnValue({
      errorMessage: undefined,
      isLoading: false,
      onStartWorkout: vi.fn(),
      template: {
        id: 'tpl-42',
        name: 'Push Day A',
        exercises: [
          { id: 'tx-1', name: 'Barbell Bench Press', setsLabel: '4 x 8' },
        ],
      },
    });
    useExerciseSelectPageDataMock.mockReturnValue({
      errorMessage: undefined,
      isLoading: false,
      items: [
        { id: 'ex-1', name: 'Barbell Bench Press' },
        { id: 'ex-2', name: 'Pull-Up' },
      ],
      onCreateExercise: vi.fn(),
      onSelectExercise: vi.fn(),
    });
    useCompletionFlowDataMock.mockReturnValue({
      progressCards: ['Chest +2 sessions', 'Back +1 session'],
      recommendedTemplate: {
        id: 'tpl-99',
        name: 'Pull Day B',
        reason: 'targets underworked lats and rear delts',
      },
      streakDays: 9,
      weeklyCoverageLabel: 'Muscle coverage: 71%',
    });
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
          clear: vi.fn(),
          completeSummary: {
            totalVolume: 9999,
            durationSeconds: 1234,
            prs: 3,
          },
        }),
    );
  });

  it('renders dashboard data from the dashboard controller', () => {
    const html = render(<DashboardPage />);
    expect(html).toContain('Current streak: 5 days');
    expect(html).toContain('Checklist: 3 / 4 complete');
    expect(html).toContain('Push Day A');
    expect(html).toContain('href="/workout/tpl-42/preview"');
  });

  it('renders history entries from session data', () => {
    const html = render(<HistoryPage />);
    expect(html).toContain('Workout History');
    expect(html).toContain('Push Day A');
    expect(html).toContain('52m');
    expect(html).toContain('12,450');
  });

  it('renders exercise selection list from controller data', () => {
    const html = render(<ExerciseSelectPage />);
    expect(html).toContain('Select Exercise');
    expect(html).toContain('Barbell Bench Press');
    expect(html).toContain('Pull-Up');
    expect(html).toContain('Create New Exercise');
  });

  it('renders workout preview details from the API-backed controller', () => {
    const html = render(<WorkoutPreviewPage />);
    expect(html).toContain('Workout Preview');
    expect(html).toContain('Push Day A');
    expect(html).toContain('Barbell Bench Press');
    expect(html).toContain('4 x 8');
  });

  it('disables workout preview start while the page is loading', () => {
    useWorkoutPreviewPageDataMock.mockReturnValue({
      errorMessage: undefined,
      isLoading: true,
      onStartWorkout: vi.fn(),
      template: {
        id: 'tpl-42',
        name: 'Push Day A',
        exercises: [
          { id: 'tx-1', name: 'Barbell Bench Press', setsLabel: '4 x 8' },
        ],
      },
    });

    const view = WorkoutPreviewPage();
    const startButton = findButtonByLabel(view, 'Start Workout');

    expect(startButton?.props.disabled).toBe(true);
  });

  it('renders a fallback message when templateId is missing', () => {
    routeParamsState.value = {};
    useWorkoutPreviewPageDataMock.mockReturnValue({
      errorMessage: 'Template not found.',
      isLoading: false,
      onStartWorkout: vi.fn(),
      template: undefined,
    });

    const html = render(<WorkoutPreviewPage />);
    expect(html).toContain('Workout Preview');
    expect(html).toContain('Template not found.');
    expect(html).toContain('href="/"');
  });

  it('renders not-found view', () => {
    const html = render(<NotFoundPage />);
    expect(html).toContain('Not Found');
    expect(html).toContain('The page does not exist.');
    expect(html).toContain('href="/"');
  });

  it('renders settings controls from controller state', () => {
    const html = render(<SettingsPage />);
    expect(html).toContain('Settings');
    expect(html).toContain('America/New_York');
    expect(html).toContain('Asia/Kolkata');
    expect(html).toContain('Metric (kg)');
    expect(html).toContain('Default Rest (seconds)');
  });

  it('renders an unsaved changes notice on settings when the form is dirty', () => {
    useSettingsPageDataMock.mockReturnValue({
      errorMessage: undefined,
      isDirty: true,
      isSaving: false,
      name: 'Iron Lifter',
      timezone: 'America/New_York',
      unitPreference: 'METRIC',
      restTimerDefaultSeconds: '120',
      timezones: ['UTC', 'America/New_York'],
      onDeleteAccount: vi.fn(),
      onLogout: vi.fn(),
      onNameChange: vi.fn(),
      onRestTimerDefaultSecondsChange: vi.fn(),
      onSave: vi.fn(),
      onTimezoneChange: vi.fn(),
      onUnitPreferenceChange: vi.fn(),
    });

    const html = render(<SettingsPage />);
    expect(html).toContain('You have unsaved changes.');
    expect(usePromptMock).toHaveBeenCalled();
    expect(useBeforeUnloadMock).toHaveBeenCalled();
  });

  it('renders completion step navigation and dynamic completion content', () => {
    expect(render(<CompletionMotivationPage />)).toContain(
      'href="/workout/complete/summary"',
    );
    expect(render(<CompletionSummaryPage />)).toContain('Volume: 9999');
    expect(render(<CompletionSummaryPage />)).toContain('PRs: 3');
    expect(render(<CompletionProgressPage />)).toContain(
      'Muscle coverage: 71%',
    );
    expect(render(<CompletionNextPage />)).toContain('Pull Day B');
    expect(render(<CompletionNextPage />)).toContain(
      'href="/workout/tpl-99/preview"',
    );
    expect(render(<CompletionStreakPage />)).toContain('9 days');
  });

  it('renders a completion-summary empty state when there is no completed workout', () => {
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
          clear: vi.fn(),
          completeSummary: undefined,
        }),
    );

    const html = render(<CompletionSummaryPage />);
    expect(html).toContain('No completed workout summary is available.');
    expect(html).toContain('href="/"');
  });

  it('clears the completed workout store from streak page', () => {
    const clearMock = vi.fn();
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
          completeSummary: {
            totalVolume: 9999,
            durationSeconds: 1234,
            prs: 3,
          },
        }),
    );

    const view = CompletionStreakPage();
    const button = findButtonByLabel(view, 'Back to Dashboard');
    expect(button).toBeDefined();

    button?.props.onClick?.();
    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
