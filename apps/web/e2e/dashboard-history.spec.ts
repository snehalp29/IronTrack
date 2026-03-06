import { expect, test } from '@playwright/test';

import { mockApi, seedAuthenticatedSession } from './support/api';

test('dashboard renders the server workout streak', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApi(page, {
    workoutStreak: {
      currentStreakDays: 4,
      longestStreakDays: 6,
      lastCompletedDate: '2026-03-05',
    },
  });

  await page.goto('/');

  await expect(
    page.getByText('Current streak: 4 days', { exact: true }),
  ).toBeVisible();
});

test('history shows only finished sessions and formats the date in the user timezone', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page, {
    sessions: [
      {
        id: 'session-finished',
        startedAt: '2026-03-06T01:30:00.000Z',
        durationSeconds: 1800,
        totalVolume: 10240,
        status: 'FINISHED',
        workoutTemplate: {
          id: 'template-1',
          name: 'Late Night Push',
        },
      },
      {
        id: 'session-in-progress',
        startedAt: '2026-03-06T14:00:00.000Z',
        durationSeconds: 900,
        totalVolume: 2048,
        status: 'IN_PROGRESS',
        workoutTemplate: {
          id: 'template-2',
          name: 'Should Not Render',
        },
      },
    ],
  });

  await page.goto('/history');

  await expect(
    page.getByRole('heading', { name: 'Workout History' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Late Night Push' }),
  ).toBeVisible();
  await expect(page.getByText('2026-03-05')).toBeVisible();
  await expect(page.getByText('Should Not Render')).toHaveCount(0);
});
