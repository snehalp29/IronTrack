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
