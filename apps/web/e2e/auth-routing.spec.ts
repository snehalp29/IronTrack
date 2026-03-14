import { expect, test } from '@playwright/test';

import { mockApi, seedAuthenticatedSession } from './support/api';

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

test('redirects unauthenticated users away from protected routes', async ({
  page,
}) => {
  await page.goto('/history');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});

test('restores an expired session before rendering a protected route', async ({
  page,
}) => {
  await seedAuthenticatedSession(page, { expiresInSeconds: -60 });
  await mockApi(page);

  const refreshRequest = page.waitForRequest('**/api/v1/auth/refresh');
  await page.goto('/history');

  await refreshRequest;
  await expect(page).toHaveURL(/\/history$/);
  await expect(
    page.getByRole('heading', { name: 'Workout History' }),
  ).toBeVisible();
});

test('redirects to login when an expired session cannot be restored', async ({
  page,
}) => {
  await seedAuthenticatedSession(page, { expiresInSeconds: -60 });
  await mockApi(page, {
    auth: {
      refreshStatus: 401,
      refreshErrorMessage: 'Session expired',
    },
  });

  await page.goto('/history');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});

test('shows client validation messages on login and register forms', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('not-an-email');
  await page.getByPlaceholder('Password').fill('short');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByText('Enter a valid email address')).toBeVisible();
  await expect(
    page.getByText('Password must be at least 8 characters'),
  ).toBeVisible();

  await page.goto('/register');
  await page.getByLabel('Email').fill('new.user@irontrack.local');
  await page.getByLabel('Password', { exact: true }).fill('DemoPass123!');
  await page
    .getByLabel('Confirm Password', { exact: true })
    .fill('Mismatch123!');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByText('Passwords do not match')).toBeVisible();
});
