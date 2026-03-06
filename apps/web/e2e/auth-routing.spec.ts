import { expect, test } from '@playwright/test';

import { mockApi } from './support/api';

test('login and register routes are reachable via client routing', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();

  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('login form submission navigates to dashboard', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('demo@irontrack.local');
  await page.getByPlaceholder('Password').fill('DemoPass123!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: 'Today Overview' }),
  ).toBeVisible();
});
