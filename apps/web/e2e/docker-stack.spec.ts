import { expect, test } from '@playwright/test';

test.describe('Docker web stack smoke', () => {
  test.skip(process.env.E2E_TARGET !== 'docker', 'Docker target only');

  test('registers through the running docker web and api stack', async ({
    page,
  }) => {
    const uniqueEmail = `docker-web-${Date.now()}-${Math.random().toString(16).slice(2)}@irontrack.local`;

    await page.goto('/register');
    await page.getByLabel('Name').fill('Docker Browser Smoke');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill('DemoPass123!');
    await page
      .getByLabel('Confirm Password', { exact: true })
      .fill('DemoPass123!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'Today Overview' }),
    ).toBeVisible();
  });
});
