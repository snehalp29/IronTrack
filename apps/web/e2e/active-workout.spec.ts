import { expect, test } from '@playwright/test';

import {
  createActiveSession,
  mockApi,
  seedAuthenticatedSession,
} from './support/api';

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

test('can edit workout notes through the notes modal and reload the saved value', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/workout/active');

  await page.getByRole('button', { name: 'Overflow' }).click();
  await page.getByRole('button', { name: 'Edit Notes' }).click();

  const notesDialog = page.getByRole('dialog', { name: 'Edit Exercise Notes' });
  const notesField = notesDialog.getByRole('textbox', { name: 'Notes' });

  await expect(notesDialog).toBeVisible();
  await notesField.fill('Pause on the chest and keep elbows tucked.');
  await page.getByRole('button', { name: 'Save Notes' }).click();

  await expect(notesDialog).toBeHidden();

  await page.getByRole('button', { name: 'Overflow' }).click();
  await page.getByRole('button', { name: 'Edit Notes' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Edit Exercise Notes' })
      .getByRole('textbox', { name: 'Notes' }),
  ).toHaveValue('Pause on the chest and keep elbows tucked.');
});

test('disables note actions while a notes save is in flight', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page, {
    delays: {
      updateExerciseMs: 600,
    },
  });
  await page.goto('/workout/active');

  await page.getByRole('button', { name: 'Overflow' }).click();
  await page.getByRole('button', { name: 'Edit Notes' }).click();

  const notesDialog = page.getByRole('dialog', { name: 'Edit Exercise Notes' });
  const saveButton = notesDialog.getByRole('button', { name: 'Save Notes' });
  const cancelButton = notesDialog.getByRole('button', { name: 'Cancel' });

  await notesDialog.getByRole('textbox', { name: 'Notes' }).fill('Tempo cue');
  await saveButton.click();

  await expect(saveButton).toBeDisabled();
  await expect(cancelButton).toBeDisabled();
  await expect(notesDialog).toBeVisible();
  await expect(notesDialog).toBeHidden();
});

test('applies a superset for multiple exercises through the browser flow', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page, {
    activeSession: createActiveSession({ includeSecondExercise: true }),
  });
  await page.goto('/workout/active');

  await page.getByRole('button', { name: 'Superset' }).click();
  await page.getByRole('button', { name: 'Select Bench Press' }).click();
  await page.getByRole('button', { name: 'Select Cable Row' }).click();

  const supersetRequest = page.waitForRequest(
    '**/api/v1/sessions/session-1/exercises/superset',
  );
  await page.getByRole('button', { name: 'Apply Superset' }).click();

  const request = await supersetRequest;
  expect(request.postDataJSON()).toEqual({
    exerciseIds: ['session-exercise-1', 'session-exercise-2'],
  });
  await expect(
    page.getByRole('dialog', { name: 'Superset Builder' }),
  ).toBeHidden();
});

test('navigates the full post-workout completion flow through summary, progress, next, and streak', async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page);
  await page.goto('/workout/active');

  await page.getByRole('button', { name: 'Finish Workout' }).click();
  await page.getByRole('button', { name: 'Finish Anyway' }).click();

  await expect(page).toHaveURL(/\/workout\/complete$/);
  await page.getByRole('link', { name: 'View Summary' }).click();
  await expect(page).toHaveURL(/\/workout\/complete\/summary$/);
  await expect(page.getByText('Volume: 10240')).toBeVisible();

  await page.getByRole('link', { name: 'Weekly Progress' }).click();
  await expect(page).toHaveURL(/\/workout\/complete\/progress$/);
  await expect(page.getByText('Muscle coverage: 66%')).toBeVisible();

  await page.getByRole('link', { name: 'Up Next' }).click();
  await expect(page).toHaveURL(/\/workout\/complete\/next$/);
  await expect(
    page.getByText(/Recommended template: Push Day A/),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Preview Workout' }),
  ).toHaveAttribute('href', '/workout/template-1/preview');

  await page.getByRole('link', { name: 'See Streak' }).click();
  await expect(page).toHaveURL(/\/workout\/complete\/streak$/);
  await expect(page.getByText('3 days')).toBeVisible();

  await page.getByRole('button', { name: 'Back to Dashboard' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: 'Today Overview' }),
  ).toBeVisible();
});
