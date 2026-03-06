import { expect, test } from '@playwright/test';

import { mockApi, seedAuthenticatedSession } from './support/api';

test('exercise select page has no nested interactive controls in links', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/exercise/select');
  await expect(page.locator('a button, button a')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Create New Exercise' }),
  ).toBeVisible();
});

test('workout preview page has no nested interactive controls in links', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/workout/template-1/preview');
  await expect(page.locator('a button, button a')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Start Workout' }),
  ).toBeVisible();
});
