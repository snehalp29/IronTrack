import { expect, test } from '@playwright/test';

test('allows finishing an incomplete workout after confirmation', async ({
  page,
}) => {
  await page.goto('/workout/active');
  await page.getByRole('button', { name: 'Start Session' }).click();
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
  await page.goto('/workout/active');
  await page.getByRole('button', { name: 'Start Session' }).click();
  await page.getByRole('button', { name: 'Finish Workout' }).click();

  await page.getByRole('button', { name: 'Continue Workout' }).click();

  await expect(page).toHaveURL(/\/workout\/active$/);
  await expect(
    page.getByRole('button', { name: 'Finish Workout' }),
  ).toBeVisible();
});
