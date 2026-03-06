# Code Review — Web Frontend (Compact)

**Branch:** `phase_one`
**Date:** 2026-03-06

## Scope

- `apps/web/src/api/client.ts`
- `apps/web/src/auth/*.ts*`
- `apps/web/src/stores/activeWorkoutStore.ts`
- `apps/web/src/hooks/useRestTimer.ts`
- `apps/web/src/App.tsx`, `src/components/layout/AppLayout.tsx`
- `apps/web/src/pages/*.tsx`
- `apps/web/src/components/workout/*.tsx`

## Status

- Total findings: **89**
- Open: **13**
- Fixed: **76**

## Fixed History

- `2026-03-06`: Closed `W1`, `W2`, `W3`, `W5`, `W6`, and `W7` by adding persisted auth session storage, automatic bearer-token injection, 401 session clearing with redirect-to-login recovery, a protected root route guard, real login/register API submissions, confirm-password validation, and Google sign-in button handlers.
- `2026-03-06`: Closed `W14`, `W15`, `W27`, `W28`, `W29`, `W30`, `W31`, and `W43` by adding auth form error handling and client-side validation, disabled/loading submit states, Google sign-in timeout and loaded-script handling, and workout-store rest-timer/session persistence hygiene.
- `2026-03-06`: Closed `W4`, `W8`–`W13`, `W16`–`W26`, and `W32`–`W44` by adding runtime API response validation, refresh-token retry on 401 with router-native login recovery, expired-session restoration in the auth guard, active-session API wiring for preview/start/finish/set toggles, configurable drift-safe rest timers, API-backed dashboard/history/settings/completion/exercise flows, completion-route guarding, and action-capable workout modals.
- `2026-03-06`: Closed `W41`, `W45`, `W46`, `W47`, `W48`, `W49`, `W50`, `W51`, `W52`, `W53`, `W54`, `W55`, `W56`, `W58`, `W59`, `W60`, `W61`, `W63`, `W64`, `W65`, `W66`, and `W67` by hardening modal focus handling, auth refresh/cookie flow, stale-session recovery, streak sourcing, timezone handling, notes/superset mutations, reorder/delete failures, and history rendering.
- `2026-03-06`: Closed `W70`, `W72`, `W74`, `W75`, `W79`, `W83`, and `W84` by moving route-query normalization out of render, making wizard/preview/logout actions non-throwing UI handlers, separating notes modal saving/error state, and disabling preview start during loading.
- `2026-03-06`: Found and closed `W88` and `W89` during the same pass by preserving template-builder values across step navigation and normalizing invalid exercise-wizard step query params back into the URL.

## Open Findings

- `W69` `P1` [ExerciseDetailPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ExerciseDetailPage.tsx): exercise detail still does not load exercise data from the API.
- `W71` `P1` [TemplateBuilderPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/TemplateBuilderPage.tsx): template builder is still scaffold-only and does not create templates through the API.
- `W68` `P1` [ExerciseWizardPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ExerciseWizardPage.tsx): the wizard still renders all fields at once instead of step-specific sections.
- `W73` `P2` [ExerciseWizardPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ExerciseWizardPage.tsx) and [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): wizard submit still lacks client-side required-field validation before hitting the API.
- `W76` `P2` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): `syncActiveSession()` still bypasses the TanStack Query cache.
- `W77` `P2` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): `useExerciseSelectPageData.onSelectExercise()` still has unhandled swap/fetch failures.
- `W78` `P2` [web-api.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-api.ts): exercise listing is still hard-capped at `pageSize=100`.
- `W80` `P2` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): settings still lose unsaved changes silently on navigation.
- `W81` `P1` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): invalid/unsupported timezones can still break localized date formatting instead of falling back safely.
- `W82` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): supported timezone list shaping is still recomputed on each settings render.
- `W85` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): template queries still use mismatched cache keys across dashboard and completion flows.
- `W86` `P2` [CompletionSummaryPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/CompletionSummaryPage.tsx): completion summary still has no direct-visit empty-state guard.
- `W87` `P3` [ExerciseWizardPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ExerciseWizardPage.tsx) and [ExerciseDetailPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ExerciseDetailPage.tsx): post-create navigation still lands on a detail page that does not render the created exercise.

## Key Outcomes

- Auth/session and active-workout flows are now heavily covered in both unit tests and Playwright, including protected-route restore/failure, notes saving, and mutation error handling.
- The preview/wizard/settings action handlers now fail safely instead of leaking unhandled promise rejections into the browser.
- Template builder navigation no longer discards entered values, and query-param normalization for exercise pages no longer mutates router state during render.
- Remaining web risk is concentrated in the still-scaffolded builder/detail pages plus a few data-layer validation, pagination, and cache-consistency gaps.

## Validation

```bash
pnpm --filter @irontrack/web test
pnpm --filter @irontrack/web typecheck
pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts
pnpm lint:code
pnpm format:check
```
