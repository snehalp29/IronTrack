import type { ReactNode } from 'react';

import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom';

import { setLoginRedirect } from './api/client';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';
import { ActiveWorkoutPage } from './pages/ActiveWorkoutPage';
import { CompletionMotivationPage } from './pages/CompletionMotivationPage';
import { CompletionNextPage } from './pages/CompletionNextPage';
import { CompletionProgressPage } from './pages/CompletionProgressPage';
import { CompletionStreakPage } from './pages/CompletionStreakPage';
import { CompletionSummaryPage } from './pages/CompletionSummaryPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { ExerciseSelectPage } from './pages/ExerciseSelectPage';
import { ExerciseWizardPage } from './pages/ExerciseWizardPage';
import { HistoryPage } from './pages/HistoryPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplateBuilderPage } from './pages/TemplateBuilderPage';
import { WorkoutPreviewPage } from './pages/WorkoutPreviewPage';
import { useActiveWorkoutStore } from './stores/activeWorkoutStore';

function RequireCompletedWorkout({ children }: { children: ReactNode }) {
  const state = useActiveWorkoutStore((store) => store.state);
  const summary = useActiveWorkoutStore((store) => store.completeSummary);

  if (state !== 'COMPLETED' || !summary) {
    return <Navigate to="/workout/active" replace />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'workout/template/new', element: <TemplateBuilderPage /> },
      { path: 'workout/:templateId/preview', element: <WorkoutPreviewPage /> },
      { path: 'workout/active', element: <ActiveWorkoutPage /> },
      {
        path: 'workout/complete',
        element: (
          <RequireCompletedWorkout>
            <CompletionMotivationPage />
          </RequireCompletedWorkout>
        ),
      },
      {
        path: 'workout/complete/summary',
        element: (
          <RequireCompletedWorkout>
            <CompletionSummaryPage />
          </RequireCompletedWorkout>
        ),
      },
      {
        path: 'workout/complete/progress',
        element: (
          <RequireCompletedWorkout>
            <CompletionProgressPage />
          </RequireCompletedWorkout>
        ),
      },
      {
        path: 'workout/complete/next',
        element: (
          <RequireCompletedWorkout>
            <CompletionNextPage />
          </RequireCompletedWorkout>
        ),
      },
      {
        path: 'workout/complete/streak',
        element: (
          <RequireCompletedWorkout>
            <CompletionStreakPage />
          </RequireCompletedWorkout>
        ),
      },
      { path: 'exercise/create', element: <ExerciseWizardPage /> },
      { path: 'exercise/select', element: <ExerciseSelectPage /> },
      { path: 'exercise/:id', element: <ExerciseDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
setLoginRedirect((path) => {
  void router.navigate(path, { replace: true });
});

export function App() {
  return <RouterProvider router={router} />;
}
