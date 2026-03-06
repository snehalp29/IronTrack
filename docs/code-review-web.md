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

- Total findings: **65**
- Open: **12**
- Fixed: **53**

## Fixed History

- `2026-03-06`: Closed `W1`, `W2`, `W3`, `W5`, `W6`, and `W7` by adding persisted auth session storage, automatic bearer-token injection, 401 session clearing with redirect-to-login recovery, a protected root route guard, real login/register API submissions, confirm-password validation, and Google sign-in button handlers.
- `2026-03-06`: Closed `W14`, `W15`, `W27`, `W28`, `W29`, `W30`, `W31`, and `W43` by adding auth form error handling and client-side validation, disabled/loading submit states, Google sign-in timeout and loaded-script handling, and workout-store rest-timer/session persistence hygiene.
- `2026-03-06`: Closed `W4`, `W8`–`W13`, `W16`–`W26`, and `W32`–`W44` by adding runtime API response validation, refresh-token retry on 401 with router-native login recovery, expired-session restoration in the auth guard, active-session API wiring for preview/start/finish/set toggles, configurable drift-safe rest timers, API-backed dashboard/history/settings/completion/exercise flows, completion-route guarding, and action-capable workout modals.
- `2026-03-06`: Closed `W41` and `W45` by adding a shared modal focus trap across workout dialogs and moving the browser refresh path to an httpOnly refresh-token cookie with access-token-only client storage.
- `2026-03-06`: Closed `W46` and `W47` during Playwright hardening by caching `useAuthSession()` snapshots for `useSyncExternalStore` stability and preventing finished workouts from being rehydrated from stale active-session query data.
- `2026-03-06`: Closed `W48`, `W49`, `W51`, `W52`, `W53`, and `W66` by routing refresh recovery through one shared in-flight client promise, making checklist/streak date math timezone-aware, and converting settings delete/save plus incomplete-finish actions into non-throwing UI handlers with explicit local error recovery.

---

## Open Findings (W50, W54–W65)

### Streak / Timezone

- `W50` `P2` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L758): `computeWorkoutStreakDays` receives the result of `listWorkoutSessions({ page: 1, pageSize: 30 })` — at most 30 sessions. A user with a 31+ day streak will see it underreported as soon as the streak length exceeds the page size. Streak should be sourced from the server's `streak` service, which already maintains `currentStreakDays` in the database.

### Active Workout

- `W54` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L615): `globalThis.prompt?.('Exercise notes', ...)` is used to collect exercise notes. The native browser prompt is a synchronous blocking dialog, cannot be styled or tested, is blocked on some mobile browsers, and breaks keyboard accessibility. The edit-notes flow should use the existing modal pattern.

- `W55` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L697): Superset group key generated as `` `group-${Date.now()}` ``. Two supersets created within the same millisecond (possible in tests or on a fast device) receive identical keys, silently merging unrelated exercises into one group. A UUID (`crypto.randomUUID()`) eliminates the collision.

- `W56` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L698): Superset `onApply` sends one `updateWorkoutExercise` call per exercise via `Promise.all`. If any call fails mid-batch (no API transaction), some exercises acquire the new `supersetGroupKey` while others retain the old value. The subsequent `syncActiveSession()` call may return a partially-applied superset state that the UI renders inconsistently.

- `W59` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L496): The `useEffect` that re-hydrates the store from `activeSessionQuery.data` short-circuits at L496 when `activeSessionQuery.data.id === sessionId && startedAt`. Background TanStack Query refetches (which may reflect exercise additions or removals from another device/tab) are therefore ignored for the lifetime of the session. Exercises added server-side do not appear without a full page reload.

- `W64` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L487): When `activeSessionQuery.data` is `null` (session deleted server-side) while the store is in `IN_PROGRESS`, the effect returns early at L488 without updating the store. The user continues to see a stale workout UI; every subsequent API mutation (`toggleSet`, `finishWorkout`) will receive a 404. The effect should detect a `null` result against a non-IDLE local `state` and clear the session.

- `W65` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L541): `onToggleSet` is pessimistic (API call first, then `updateSet`). The rest timer only starts after the network round-trip. On a slow connection this adds perceptible latency to every set completion. An optimistic update — applying `updateSet` immediately and rolling back on error — would make the interaction feel instant.

### History / Data

- `W60` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L116): `useHistoryPageData` calls `listWorkoutSessions({ page: 1, pageSize: 20 })` without filtering by `status`. In-progress sessions will appear in the history list showing "Volume: 0" and no duration, confusing users. The query should filter to `FINISHED` sessions only (supported via the API's `status` filter or date range).

- `W61` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L339): `recommendedTemplate` in `useCompletionFlowData` always returns `templatesQuery.data?.[0]` — the first template alphabetically or by creation order. The `buildRecommendationReason` function references muscle coverage data but the template selection ignores it entirely. Template ordering should rank by which template best covers the least-worked muscles from `perMuscleVolume`.

### Performance

- `W58` `P3` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L199): `getSupportedTimezones(timezone)` is called on every render of `useSettingsPageData`. `Intl.supportedValuesOf('timeZone')` returns ~400+ entries and `new Set([...])` creates a new array on each call. This should be wrapped in `useMemo` (or computed once outside the hook).

- `W63` `P4` [web-data.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/lib/web-data.ts#L87): Sessions are fetched three times with distinct query keys (`['sessions', 'dashboard']`, `['sessions', 'history']`, `['sessions', 'completion']`) even though all three calls use the same parameters. No `staleTime` is configured on any query, so navigating between Dashboard → History → Completion triggers three redundant `GET /sessions` requests per navigation. A shared query key and `staleTime` would eliminate the duplication.

---

## Key Outcomes

- The web app is no longer scaffold-only. Dashboard, history, settings, workout preview, completion flow, exercise selection/creation, and active workout state now read and write real API-backed data.
- Auth/session handling is materially stronger: client-side runtime response validation, refresh-token retry on 401, router-native login redirection, expired-session restoration in the guard, cached auth snapshots, and httpOnly refresh-cookie rotation are all in place.
- Workout dialogs now trap keyboard focus correctly, and completion routing is stable after a finished session.
- The highest-priority remaining work is replacing client-derived streak calculation with a server-backed streak source (W50), then cleaning up active-workout consistency issues around prompt-based notes, non-atomic superset updates, and stale cross-tab session state (W54–W56, W59, W64, W65).

## Validation

```bash
pnpm --filter @irontrack/web test
pnpm --filter @irontrack/web typecheck
pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts
pnpm lint:code
pnpm format:check
```
