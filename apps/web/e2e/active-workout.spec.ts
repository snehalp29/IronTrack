import { expect, test } from '@playwright/test';

import { mockApi, seedAuthenticatedSession } from './support/api';

test('allows finishing an incomplete workout after confirmation', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/workout/active');
  await page.getByRole('button', { name: 'Finish Workout' }).click();

  await expect(
    page.getByRole('heading', { name: 'Incomplete Workout' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Finish Anyway' }).click();

  await expect(page).toHaveURL(/\/workout\/complete$/);
  await expect(
    page.getByRole('heading', { name: 'Workout Complete' }),
  ).toBeVisible();
});

test('can dismiss incomplete warning and continue workout', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/workout/active');
  await page.getByRole('button', { name: 'Finish Workout' }).click();

  await page.getByRole('button', { name: 'Continue Workout' }).click();

  await expect(page).toHaveURL(/\/workout\/active$/);
  await expect(
    page.getByRole('button', { name: 'Finish Workout' }),
  ).toBeVisible();
});

test('keeps keyboard focus trapped inside the incomplete workout modal', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/workout/active');
  await page.getByRole('button', { name: 'Finish Workout' }).click();

  const finishAnywayButton = page.getByRole('button', {
    name: 'Finish Anyway',
  });
  const continueButton = page.getByRole('button', { name: 'Continue Workout' });

  await expect(finishAnywayButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(continueButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(finishAnywayButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(continueButton).toBeFocused();
});
