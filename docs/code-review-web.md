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
- Open: **2**
- Fixed: **87**

## Fixed History

- `2026-03-06`: Closed `W1`, `W2`, `W3`, `W5`, `W6`, and `W7` by adding persisted auth session storage, automatic bearer-token injection, 401 session clearing with redirect-to-login recovery, a protected root route guard, real login/register API submissions, confirm-password validation, and Google sign-in button handlers.
- `2026-03-06`: Closed `W14`, `W15`, `W27`, `W28`, `W29`, `W30`, `W31`, and `W43` by adding auth form error handling and client-side validation, disabled/loading submit states, Google sign-in timeout and loaded-script handling, and workout-store rest-timer/session persistence hygiene.
- `2026-03-06`: Closed `W4`, `W8`–`W13`, `W16`–`W26`, and `W32`–`W44` by adding runtime API response validation, refresh-token retry on 401 with router-native login recovery, expired-session restoration in the auth guard, active-session API wiring for preview/start/finish/set toggles, configurable drift-safe rest timers, API-backed dashboard/history/settings/completion/exercise flows, completion-route guarding, and action-capable workout modals.
- `2026-03-06`: Closed `W41`, `W45`, `W46`, `W47`, `W48`, `W49`, `W50`, `W51`, `W52`, `W53`, `W54`, `W55`, `W56`, `W58`, `W59`, `W60`, `W61`, `W63`, `W64`, `W65`, `W66`, and `W67` by hardening modal focus handling, auth refresh/cookie flow, stale-session recovery, streak sourcing, timezone handling, notes/superset mutations, reorder/delete failures, and history rendering.
- `2026-03-06`: Closed `W70`, `W72`, `W74`, `W75`, `W79`, `W83`, and `W84` by moving route-query normalization out of render, making wizard/preview/logout actions non-throwing UI handlers, separating notes modal saving/error state, and disabling preview start during loading.
- `2026-03-06`: Found and closed `W88` and `W89` during the same pass by preserving template-builder values across step navigation and normalizing invalid exercise-wizard step query params back into the URL.
- `2026-03-06`: Closed `W68`, `W69`, `W73`, `W76`, `W77`, `W78`, `W81`, `W82`, `W85`, `W86`, and `W87` by wiring real exercise detail/history endpoints into the UI, making the exercise wizard genuinely step-based with client-side validation, syncing active-session refreshes back into the query cache, catching exercise-swap failures, paginating exercise listing across all pages, adding safe timezone fallback/cached timezone options, aligning template cache keys, guarding completion summary empty states, and extending Playwright to cover the wizard-to-detail browser flow.

## Open Findings

- `W71` `P1` [TemplateBuilderPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/TemplateBuilderPage.tsx): template builder is still scaffold-only and does not create templates through the API.
- `W80` `P2` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts): settings still lose unsaved changes silently on navigation.

## Key Outcomes

- Auth/session and active-workout flows remain heavily covered in both unit tests and Playwright, including protected-route restore/failure, notes saving, superset application, and mutation error handling.
- Exercise creation now uses a real step-based wizard with client validation, and post-create navigation lands on an API-backed detail page with guide/history rendering.
- Date/time handling is now safer and more consistent across history, settings, and exercise detail flows, and exercise selection no longer truncates after the first page.
- Remaining web risk is concentrated in the still-scaffolded template-builder create flow and unsaved-settings navigation protection.

## Validation

```bash
pnpm --filter @irontrack/web test
pnpm --filter @irontrack/web typecheck
pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts
pnpm lint:code
pnpm format:check
```
