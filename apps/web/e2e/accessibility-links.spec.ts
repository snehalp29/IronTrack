import { expect, test } from '@playwright/test';

test('exercise select page has no nested interactive controls in links', async ({
  page,
}) => {
  await page.goto('/exercise/select');
  await expect(page.locator('a button')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Create New Exercise' }),
  ).toBeVisible();
});

test('workout preview page has no nested interactive controls in links', async ({
  page,
}) => {
  await page.goto('/workout/123/preview');
  await expect(page.locator('a button')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Start Workout' })).toBeVisible();
});
