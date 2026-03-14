import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'playwright.config.spec.ts',
      'vitest-coverage-config.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/App.tsx',
        'src/api/**/*.ts',
        'src/stores/**/*.ts',
        'src/hooks/**/*.ts',
        'src/components/workout/**/*.tsx',
        'src/components/layout/**/*.tsx',
        'src/pages/ActiveWorkoutPage.tsx',
        'src/pages/Completion*.tsx',
        'src/pages/DashboardPage.tsx',
        'src/pages/ExerciseDetailPage.tsx',
        'src/pages/ExerciseSelectPage.tsx',
        'src/pages/ExerciseWizardPage.tsx',
        'src/pages/HistoryPage.tsx',
        'src/pages/LoginPage.tsx',
        'src/pages/NotFoundPage.tsx',
        'src/pages/RegisterPage.tsx',
        'src/pages/SettingsPage.tsx',
        'src/pages/TemplateBuilderPage.tsx',
        'src/pages/WorkoutPreviewPage.tsx',
        'src/main.tsx',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
