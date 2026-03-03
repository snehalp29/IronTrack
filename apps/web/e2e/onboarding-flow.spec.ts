import { expect, test } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('first-time user can register and complete initial setup steps', async ({
    page,
  }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
    await page.getByLabel('Name').fill('Iron Tracker');
    await page.getByLabel('Email').fill('new.user@irontrack.local');
    await page.getByLabel('Password', { exact: true }).fill('DemoPass123!');
    await page
      .getByLabel('Confirm Password', { exact: true })
      .fill('DemoPass123!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'Today Overview' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.getByLabel('Timezone').selectOption('America/New_York');
    await page.getByLabel('Units').selectOption('IMPERIAL');
    await expect(page.getByLabel('Timezone')).toHaveValue('America/New_York');
    await expect(page.getByLabel('Units')).toHaveValue('IMPERIAL');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await page.getByRole('link', { name: 'Exercises' }).click();
    await expect(page).toHaveURL(/\/exercise\/select$/);
    await expect(
      page.getByRole('heading', { name: 'Select Exercise' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Create New Exercise' }).click();
    await expect(page).toHaveURL(/\/exercise\/create$/);
    await expect(
      page.getByRole('heading', { name: 'Create / Edit Exercise' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('link', { name: 'Create Template' }).click();

    await expect(page).toHaveURL(/\/workout\/template\/new$/);
    await expect(
      page.getByRole('heading', { name: 'Template Builder' }),
    ).toBeVisible();
    await page.getByLabel('Template name').fill('Push Day A');
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByLabel('Exercise selection and defaults')
      .fill('Bench Press 4x8\nIncline Press 3x10');
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByLabel('Superset and order review')
      .fill('No supersets for first template');
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByLabel('Final review and notes')
      .fill('Focus on controlled tempo and full range');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('link', { name: 'Start' }).click();
    await expect(page).toHaveURL(/\/workout\/active$/);

    await page.getByRole('button', { name: 'Start Session' }).click();
    await expect(
      page.getByRole('heading', { name: 'Active Workout' }),
    ).toBeVisible();

    const setButtons = page.getByRole('button', { name: /Set \d:/ });
    const setCount = await setButtons.count();
    for (let index = 0; index < setCount; index += 1) {
      await setButtons.nth(index).click();
    }

    await page.getByRole('button', { name: 'Finish Workout' }).click();
    await expect(page).toHaveURL(/\/workout\/complete$/);
    await expect(
      page.getByRole('heading', { name: 'Workout Complete' }),
    ).toBeVisible();
  });

  test('existing user can log in and reach setup pages', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await page.getByLabel('Email').fill('demo@irontrack.local');
    await page.getByLabel('Password').fill('DemoPass123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'Today Overview' }),
    ).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.goto('/exercise/select');
    await expect(
      page.getByRole('heading', { name: 'Select Exercise' }),
    ).toBeVisible();
  });
});
