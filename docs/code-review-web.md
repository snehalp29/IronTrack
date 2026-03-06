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

- Total findings: **47**
- Open: **0**
- Fixed: **47**

## Fixed History

- `2026-03-06`: Closed `W1`, `W2`, `W3`, `W5`, `W6`, and `W7` by adding persisted auth session storage, automatic bearer-token injection, 401 session clearing with redirect-to-login recovery, a protected root route guard, real login/register API submissions, confirm-password validation, and Google sign-in button handlers.
- `2026-03-06`: Closed `W14`, `W15`, `W27`, `W28`, `W29`, `W30`, `W31`, and `W43` by adding auth form error handling and client-side validation, disabled/loading submit states, Google sign-in timeout and loaded-script handling, and workout-store rest-timer/session persistence hygiene.
- `2026-03-06`: Closed `W4`, `W8`–`W13`, `W16`–`W26`, and `W32`–`W44` by adding runtime API response validation, refresh-token retry on 401 with router-native login recovery, expired-session restoration in the auth guard, active-session API wiring for preview/start/finish/set toggles, configurable drift-safe rest timers, API-backed dashboard/history/settings/completion/exercise flows, completion-route guarding, and action-capable workout modals.
- `2026-03-06`: Closed `W41` and `W45` by adding a shared modal focus trap across workout dialogs and moving the browser refresh path to an httpOnly refresh-token cookie with access-token-only client storage.
- `2026-03-06`: Closed `W46` and `W47` during Playwright hardening by caching `useAuthSession()` snapshots for `useSyncExternalStore` stability and preventing finished workouts from being rehydrated from stale active-session query data.

## Key Outcomes

- The web app is no longer scaffold-only. Dashboard, history, settings, workout preview, completion flow, exercise selection/creation, and active workout state now read and write real API-backed data.
- Auth/session handling is materially stronger: client-side runtime response validation, refresh-token retry on 401, router-native login redirection, expired-session restoration in the guard, cached auth snapshots, and httpOnly refresh-cookie rotation are all in place.
- Workout dialogs now trap keyboard focus correctly, and completion routing is stable after a finished session.
- There are no remaining tracked open web defects in this reviewed scope.

## Validation

```bash
pnpm --filter @irontrack/web test
pnpm --filter @irontrack/web typecheck
pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts
pnpm lint:code
pnpm format:check
```
