import { expect, test } from '@playwright/test';

import { mockApi, seedAuthenticatedSession } from './support/api';

test.describe('Onboarding Flow', () => {
  test('exercise wizard validates step flow and loads the created detail page', async ({
    page,
  }) => {
    await seedAuthenticatedSession(page);
    await mockApi(page);
    await page.goto('/exercise/create');

    await expect(
      page.getByRole('heading', { name: 'Create / Edit Exercise' }),
    ).toBeVisible();
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Primary Muscle')).toHaveCount(0);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Exercise name is required')).toBeVisible();

    await page.getByLabel('Name', { exact: true }).fill('Incline Press');
    await page.getByLabel('Description').fill('Upper chest compound press.');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByLabel('Exercise Type')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByLabel('Primary Muscle')).toBeVisible();
    await page.getByLabel('Primary Muscle').selectOption('muscle-1');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByLabel('Secondary Muscles')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByLabel('Equipment')).toBeVisible();
    await page.getByLabel('Equipment').selectOption('equipment-1');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByLabel('Default Sets')).toBeVisible();
    await page.getByLabel('Default Sets').fill('4');
    await page.getByLabel('Rep Min').fill('6');
    await page.getByLabel('Rep Max').fill('8');
    await page.getByLabel('Default Cues').fill('Keep wrists stacked.');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Incline Press')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Submit Exercise' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Submit Exercise' }).click();

    await expect(page).toHaveURL(/\/exercise\/exercise-created$/);
    await expect(
      page.getByRole('heading', { name: 'Incline Press' }),
    ).toBeVisible();
    await expect(
      page.getByText('Pause on the chest and drive through the bar.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByText(/100 x 8/)).toBeVisible();
  });

  test('template builder preserves entered values across step navigation', async ({
    page,
  }) => {
    await seedAuthenticatedSession(page);
    await mockApi(page);
    await page.goto('/workout/template/new');

    const templateName = page.getByLabel('Template Name', { exact: true });
    await templateName.fill('Push Day A');
    await page.getByRole('button', { name: 'Next' }).click();
    const benchPressToggle = page.getByLabel('Bench Press', { exact: true });
    await benchPressToggle.check();
    await page.getByLabel('Default Sets for Bench Press').fill('4');
    await page.getByRole('button', { name: 'Back' }).click();

    await expect(templateName).toHaveValue('Push Day A');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(benchPressToggle).toBeChecked();
    await expect(page.getByLabel('Default Sets for Bench Press')).toHaveValue(
      '4',
    );
  });

  test('first-time user can register and complete initial setup steps', async ({
    page,
  }) => {
    await mockApi(page);
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

    await page.getByRole('button', { name: 'Create New Exercise' }).click();
    await expect(page).toHaveURL(/\/exercise\/create(\?step=1)?$/);
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
    await page.getByLabel('Template Name', { exact: true }).fill('Push Day A');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Bench Press', { exact: true }).check();
    await page.getByLabel('Default Sets for Bench Press').fill('4');
    await page.getByLabel('Rep Min for Bench Press').fill('8');
    await page.getByLabel('Rep Max for Bench Press').fill('10');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Superset group for Bench Press').fill('A');
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByLabel('Final review and notes', { exact: true })
      .fill('Focus on controlled tempo and full range');
    await page.getByRole('button', { name: 'Create Template' }).click();

    await expect(page).toHaveURL(/\/workout\/template-created\/preview$/);
    await expect(
      page.getByRole('heading', { name: 'Workout Preview' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Start Workout' }).click();
    await expect(page).toHaveURL(/\/workout\/active$/);

    await expect(
      page.getByRole('heading', { name: 'Active Workout' }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: /Set 2: .*tap to complete/ })
      .click();

    await page.getByRole('button', { name: 'Finish Workout' }).click();
    await expect(page).toHaveURL(/\/workout\/complete$/);
    await expect(
      page.getByRole('heading', { name: 'Workout Complete' }),
    ).toBeVisible();
  });

  test('existing user can log in and reach setup pages', async ({ page }) => {
    await seedAuthenticatedSession(page);
    await mockApi(page);
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
