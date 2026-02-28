import { RouterProvider, createBrowserRouter } from 'react-router-dom';

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

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'workout/template/new', element: <TemplateBuilderPage /> },
      { path: 'workout/:templateId/preview', element: <WorkoutPreviewPage /> },
      { path: 'workout/active', element: <ActiveWorkoutPage /> },
      { path: 'workout/complete', element: <CompletionMotivationPage /> },
      { path: 'workout/complete/summary', element: <CompletionSummaryPage /> },
      {
        path: 'workout/complete/progress',
        element: <CompletionProgressPage />,
      },
      { path: 'workout/complete/next', element: <CompletionNextPage /> },
      { path: 'workout/complete/streak', element: <CompletionStreakPage /> },
      { path: 'exercise/create', element: <ExerciseWizardPage /> },
      { path: 'exercise/select', element: <ExerciseSelectPage /> },
      { path: 'exercise/:id', element: <ExerciseDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
