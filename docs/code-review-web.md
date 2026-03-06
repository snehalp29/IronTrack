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

- Total findings: **25**
- Open: **19**
- Fixed: **6**

## Fixed History

- `2026-03-06`: Closed `W1`, `W2`, `W3`, `W5`, `W6`, and `W7` by adding persisted auth session storage, automatic bearer-token injection, 401 session clearing with redirect-to-login recovery, a protected root route guard, real login/register API submissions, confirm-password validation, and Google sign-in button handlers.

## Open Findings

### Auth / API Layer

- `W4` `P4` [client.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/api/client.ts#L47): `JSON.parse(text) as T` performs no runtime schema validation. Unexpected or malformed server shapes are silently cast to `T` and surface as runtime errors deep in the UI.

### Auth Pages

### Active Workout

- `W8` `P1` [ActiveWorkoutPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ActiveWorkoutPage.tsx#L70): When state is `IDLE`, pressing "Start Session" calls `start('session-local-1', seedExercises)` using a hardcoded fake session ID and a module-level `seedExercises` constant (L13–33). No API call to `POST /sessions` is made; the session never exists on the server.

- `W9` `P1` [ActiveWorkoutPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ActiveWorkoutPage.tsx#L60): `finalizeWorkout()` calls `finish({ totalVolume: 12450, durationSeconds: 3120, prs: 2 })` — hardcoded fake stats passed to the store, and no `POST /sessions/:id/finish` call is made. The API session is never finished.

- `W10` `P2` [ActiveWorkoutPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ActiveWorkoutPage.tsx#L106): Set completion toggle (`updateSet`) only updates local store state — no `PATCH /sessions/:sessionId/exercises/:id/sets/:setId` or toggle-completion call is sent to the server.

- `W11` `P2` [ExerciseOverflowModal.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/components/workout/ExerciseOverflowModal.tsx#L18): "Edit Notes", "Swap Exercise", and "Delete Exercise" buttons have no `onClick` handlers. The modal closes but no action is taken.

- `W12` `P2` [ReorderModal.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/components/workout/ReorderModal.tsx) / [SupersetModal.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/components/workout/SupersetModal.tsx): Both modals are UI-only placeholders. `ReorderModal` contains only the text "Drag-and-drop list placeholder" with a Done button that closes without applying any reorder. `SupersetModal` Apply button closes without linking any exercises.

### Active Workout Store

- `W13` `P2` [activeWorkoutStore.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/stores/activeWorkoutStore.ts#L153): `updateSet` hardcodes `restTimerSeconds: 90` whenever `patch.isCompleted` is truthy. The rest duration is not configurable and ignores any user preference. Toggling a set to completed on a slow exercise always resets the timer to 90 s even if a different duration was previously set.

- `W14` `P3` [activeWorkoutStore.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/stores/activeWorkoutStore.ts#L182): `finish()` sets `state: 'COMPLETED'` but leaves `sessionId` populated. Any code that reads `sessionId` after completion will operate on a stale ID until `clear()` is explicitly called.

- `W15` `P3` [activeWorkoutStore.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/stores/activeWorkoutStore.ts#L215): `persist` config has no `version` field and no `migrate` callback. Any change to the `ActiveWorkoutState` shape will silently deserialize into a corrupt object from existing localStorage, causing runtime errors for returning users.

### Rest Timer

- `W16` `P3` [useRestTimer.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/hooks/useRestTimer.ts): Uses `setInterval(() => tick(), 1000)`. Browsers throttle intervals in hidden/backgrounded tabs to ≥1 s (often multiple seconds). A user who locks their screen mid-workout will see the rest timer significantly behind real elapsed time when they return.

### Completion Flow

- `W17` `P2` [CompletionProgressPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/CompletionProgressPage.tsx#L7) / [CompletionNextPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/CompletionNextPage.tsx#L8): Hardcoded "Muscle coverage: 71%" and "Recommended template: Pull Day B" — no API call to `GET /progress/weekly` or `GET /workout-templates`. Data shown is always fabricated.

- `W18` `P2` [CompletionStreakPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/CompletionStreakPage.tsx#L12): Streak hardcoded to "8 days". `completeSummary` in the store only holds `totalVolume`, `durationSeconds`, and `prs` — there is nowhere in the data model to carry the real streak count from the server, so even wiring an API call here would require a store field addition.

- `W19` `P3` [App.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/App.tsx#L35): The entire `/workout/complete/*` route tree is navigable by URL regardless of store state. A user who visits `/workout/complete/summary` without having finished a workout will see `summary?.totalVolume ?? 0` (all zeroes from `undefined`) — no guard checks `state === 'COMPLETED'` before rendering these pages.

### Other Pages

- `W20` `P2` [DashboardPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/DashboardPage.tsx): All displayed data is hardcoded (streak "7 days", checklist "3/4", template "Push Day A", link to `/workout/123/preview`). No API calls to any endpoint.

- `W21` `P2` [HistoryPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/HistoryPage.tsx): Uses a `mockHistory` module constant with 3 hardcoded entries. No call to `GET /sessions`.

- `W22` `P2` [SettingsPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/SettingsPage.tsx): Save, Logout, and Delete Account buttons have no `onClick` handlers. Clicking any of them does nothing.

- `W23` `P2` [WorkoutPreviewPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/WorkoutPreviewPage.tsx): Reads `templateId` from params but renders a hardcoded exercise list regardless. No call to `GET /workout-templates/:id`.

- `W24` `P2` [ExerciseSelectPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ExerciseSelectPage.tsx#L3): Exercise list is a module-level constant `['Barbell Bench Press', 'Pull-Up', 'Barbell Back Squat']`. No call to `GET /exercises`. Buttons have no `onClick` — selecting an exercise does nothing.

- `W25` `P2` [ExerciseWizardPage.tsx](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/web/src/pages/ExerciseWizardPage.tsx#L39): Each step renders a single uncontrolled `<textarea>`. Step navigation via URL params means React remounts the component, clearing any typed content. Reaching the final step and clicking Next increments the step counter past the last step rather than submitting — there is no `POST /exercises` call and no submit path.

## Key Outcomes

- The web frontend is still scaffold-heavy, but the auth token lifecycle is now in place. Protected routes, login/register API submissions, persisted sessions, and Google sign-in button wiring are no longer blocking the rest of the app.
- The highest-priority remaining work is replacing hardcoded active-workout and dashboard/history/template data with real API reads and writes.
- Store persistence versioning (W15) should be addressed before any schema-altering store changes go out to real users.
- Completion flow routes (W19) and modal action wiring (W11, W12) are self-contained and can be fixed independently once the auth layer is in place.

## Validation

```bash
pnpm --filter @irontrack/web test
pnpm --filter @irontrack/web typecheck
pnpm lint:code
pnpm format:check
```
