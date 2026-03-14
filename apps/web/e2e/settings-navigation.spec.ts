import { expect, test } from '@playwright/test';

import { mockApi, seedAuthenticatedSession } from './support/api';

test('prompts before leaving settings with unsaved changes', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/settings');

  await page.getByLabel('Name', { exact: true }).fill('Updated Lifter');

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('unsaved changes');
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Dashboard' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('You have unsaved changes.')).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('unsaved changes');
    await dialog.accept();
  });
  await page.getByRole('link', { name: 'Dashboard' }).click();

  await expect(page).toHaveURL(/\/$/);
});

test('allows logout from settings without showing the unsaved changes prompt', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/settings');

  await page.getByLabel('Name', { exact: true }).fill('Updated Lifter');
  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test('allows account deletion from settings', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/settings');

  await page.getByRole('button', { name: 'Delete Account' }).click();

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
});

test('persists saved settings across reload', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/settings');

  await page.getByLabel('Name', { exact: true }).fill('Updated Lifter');
  await page.getByLabel('Timezone').selectOption('UTC');
  await page.getByLabel('Units').selectOption('METRIC');
  await page.getByLabel('Default Rest (seconds)').fill('75');
  await expect(page.getByLabel('Timezone')).toHaveValue('UTC');
  await expect(page.getByLabel('Units')).toHaveValue('METRIC');
  await expect(page.getByLabel('Default Rest (seconds)')).toHaveValue('75');
  await page.getByRole('button', { name: 'Save Settings' }).click();

  await expect(page.getByText('You have unsaved changes.')).toHaveCount(0);
  await page.reload();

  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
    'Updated Lifter',
  );
  await expect(page.getByLabel('Timezone')).toHaveValue('UTC');
  await expect(page.getByLabel('Units')).toHaveValue('METRIC');
  await expect(page.getByLabel('Default Rest (seconds)')).toHaveValue('75');
});
