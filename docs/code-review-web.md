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

- Total findings: **87**
- Open: **20**
- Fixed: **67**

## Fixed History

- `2026-03-06`: Closed `W1`, `W2`, `W3`, `W5`, `W6`, and `W7` by adding persisted auth session storage, automatic bearer-token injection, 401 session clearing with redirect-to-login recovery, a protected root route guard, real login/register API submissions, confirm-password validation, and Google sign-in button handlers.
- `2026-03-06`: Closed `W14`, `W15`, `W27`, `W28`, `W29`, `W30`, `W31`, and `W43` by adding auth form error handling and client-side validation, disabled/loading submit states, Google sign-in timeout and loaded-script handling, and workout-store rest-timer/session persistence hygiene.
- `2026-03-06`: Closed `W4`, `W8`–`W13`, `W16`–`W26`, and `W32`–`W44` by adding runtime API response validation, refresh-token retry on 401 with router-native login recovery, expired-session restoration in the auth guard, active-session API wiring for preview/start/finish/set toggles, configurable drift-safe rest timers, API-backed dashboard/history/settings/completion/exercise flows, completion-route guarding, and action-capable workout modals.
- `2026-03-06`: Closed `W41` and `W45` by adding a shared modal focus trap across workout dialogs and moving the browser refresh path to an httpOnly refresh-token cookie with access-token-only client storage.
- `2026-03-06`: Closed `W46` and `W47` during Playwright hardening by caching `useAuthSession()` snapshots for `useSyncExternalStore` stability and preventing finished workouts from being rehydrated from stale active-session query data.
- `2026-03-06`: Closed `W48`, `W49`, `W51`, `W52`, `W53`, and `W66` by routing refresh recovery through one shared in-flight client promise, making checklist/streak date math timezone-aware, and converting settings delete/save plus incomplete-finish actions into non-throwing UI handlers with explicit local error recovery.
- `2026-03-06`: Closed `W50` and `W63` by exposing a protected workout-streak API endpoint and switching dashboard/completion to the server-backed streak query instead of paged session history.
- `2026-03-06`: Closed `W54`, `W55`, `W56`, `W58`, `W59`, `W60`, `W61`, `W64`, and `W65` by replacing prompt-based notes with a real modal, moving superset writes to one atomic session endpoint, caching supported timezones, filtering history to finished sessions, ranking recommended templates by least-worked muscle coverage, syncing or clearing local workouts from server refreshes, and making set completion optimistic with rollback.
- `2026-03-06`: Found and closed `W67` and `W68` during the same pass by catching active-workout reorder/delete mutation failures and formatting history dates in the user timezone instead of UTC slicing.

---

## Open Findings

### Pass 4 — 2026-03-06

---

**W68 — P1 — ExerciseWizardPage: all fields rendered simultaneously regardless of step**
`apps/web/src/pages/ExerciseWizardPage.tsx`

The multi-step wizard renders every field (Name, Description, Type, Primary Muscle, Secondary Muscles, Equipment, Default Sets, Rep Min, Rep Max, Default Cues) unconditionally in a single form. The `data.step` value and `data.isSubmitStep` flag only change the button label; no per-step conditional rendering exists. Users see all 10+ fields at once, defeating the wizard UX entirely. Each step should render only its designated field(s).

---

**W69 — P1 — ExerciseDetailPage: exercise data never loaded from API**
`apps/web/src/pages/ExerciseDetailPage.tsx`

The page extracts `:id` from `useParams()` but never passes it to any API call. `useExerciseDetailPageData` (if it exists) or the page itself shows hardcoded placeholder text ("Barbell Back Squat", static guide content). A real `fetchExerciseById` call must be made with the route id, and the response used to populate name, description, type, muscle groups, and guide content.

---

**W70 — P2 — ExerciseDetailPage: `setSearchParams` called during render phase**
`apps/web/src/pages/ExerciseDetailPage.tsx:13–17`

The tab-narrowing logic calls `setSearchParams` directly in the component render body:

```tsx
if (rawTab !== 'history' && rawTab !== 'guide') {
  setSearchParams({ tab: 'guide' });
}
```

Calling a state setter during render is a React violation — it causes an extra render cycle, produces a console error in StrictMode, and in React 19 Strict Mode runs twice, pushing two history entries. Move the guard into a `useEffect(() => { ... }, [rawTab])`.

---

**W71 — P0 — TemplateBuilderPage: completely unimplemented (scaffold only)**
`apps/web/src/pages/TemplateBuilderPage.tsx`

The page contains uncontrolled `<input>` and `<textarea>` elements with no `useState`, no form library, no `web-data` hook, and no API calls. The final step's "Next" button stays on step 4 with no submit action and no `POST /workout-templates` call. The Template Builder is a core feature that is fully non-functional.

---

**W72 — P2 — ExerciseWizardPage: unhandled rejection from `mutateAsync` at call site**
`apps/web/src/pages/ExerciseWizardPage.tsx`

`data.onSubmit()` invokes `mutateAsync(...)` without a try/catch. `mutateAsync` rethrows on error (unlike `mutate`). A network failure or 4xx response during exercise creation produces an unhandled promise rejection; no error is surfaced to the user. Wrap the call site in try/catch and display an error message, or switch to `mutate` with `onError`.

---

**W73 — P2 — ExerciseWizardPage: no pre-submit field validation**
`apps/web/src/pages/ExerciseWizardPage.tsx` / `apps/web/src/lib/web-data.ts`

`useExerciseWizardPageData.onSubmit` calls `createExercise` with whatever is in the form state. Fields like `name` (can be empty string), `primaryMuscleGroupId` (can be empty string `''`), and `exerciseType` have no client-side required-field check before submission. The API will return a 400, but no UI-level error is shown and no field is highlighted. Add validation before calling `mutateAsync`.

---

**W74 — P2 — useActiveWorkoutPageData: `notes.isSaving` hardcoded `false`**
`apps/web/src/lib/web-data.ts:784`

The notes object returned to `ActiveWorkoutPage` has `isSaving: false` hardcoded. The "Save Notes" button is therefore never disabled during the async `updateWorkoutExercise` call, allowing the user to submit multiple times concurrently. Introduce a local `isSavingNotes` boolean (via `useState` or a mutation's `isPending` flag) and thread it through.

---

**W75 — P2 — useActiveWorkoutPageData: notes `errorMessage` shares global `errorMessage` state**
`apps/web/src/lib/web-data.ts:783`

`notes.errorMessage` is populated from the same `errorMessage` state variable used for other active-workout errors (set toggling, reorder, delete). An unrelated failure — e.g., a set-toggle rollback — can set `errorMessage` and display spurious text inside the notes modal while it is open, and vice versa. Maintain a separate `notesErrorMessage` state for the notes modal.

---

**W76 — P2 — syncActiveSession bypasses TanStack Query cache**
`apps/web/src/lib/web-data.ts:574–585`

`syncActiveSession()` calls `fetchActiveSession()` directly (a raw `apiFetch` call) and writes the result into the Zustand store via `syncFromServer`. The TanStack Query cache for `['sessions', 'active']` is never updated. After `syncActiveSession` runs, subsequent reads from the query cache return stale data, causing the UI to revert. Replace the direct fetch with `queryClient.fetchQuery(['sessions', 'active'], fetchActiveSession)` so the cache stays in sync.

---

**W77 — P2 — useExerciseSelectPageData.onSelectExercise: unhandled rejection**
`apps/web/src/lib/web-data.ts:327–343`

`onSelectExercise` calls `swapWorkoutExercise(...)` and then `fetchActiveSession()` with no try/catch. A swap failure produces an unhandled promise rejection; the exercise list is not reverted, leaving the UI in an inconsistent state. Wrap in try/catch, show an error message, and if the swap fails leave the selection unchanged.

---

**W78 — P2 — listExercises hard-capped at pageSize=100**
`apps/web/src/lib/web-api.ts:396`

```ts
apiFetch('/exercises?page=1&pageSize=100', ...)
```

Any user or library with more than 100 exercises will see a silently truncated list in the exercise select and wizard pages. Either paginate properly (infinite scroll or load-more) or at minimum fetch subsequent pages until `items.length < pageSize` and concatenate results.

---

**W79 — P2 — useSettingsPageData.onLogout: network failure unhandled**
`apps/web/src/lib/web-data.ts:238–241`

`onLogout` calls `logoutCurrentSession()` without a try/catch. If the network request fails the user remains on the settings page with no feedback, still authenticated. Wrap in try/catch: on failure, show an error message; on success (or if the network fails and the session is already cleared client-side), clear the auth session and redirect.

---

**W80 — P2 — useSettingsPageData: unsaved changes silently lost on navigation**
`apps/web/src/lib/web-data.ts` (settings hook)

The settings form holds `name`, `timezone`, and `unitPreference` in local state. If a user edits the form and navigates away without saving, changes are discarded with no warning. Add a React Router `useBlocker` (or `<Prompt>`) that guards navigation when form values differ from the fetched user data.

---

**W81 — P1 — formatDateInTimezone throws on incomplete `formatToParts` result**
`apps/web/src/lib/web-data.ts:905–907`

```ts
const year = parts.find((p) => p.type === 'year')!.value;
const month = parts.find((p) => p.type === 'month')!.value;
const day = parts.find((p) => p.type === 'day')!.value;
```

All three use non-null assertion. If `Intl.DateTimeFormat` with an invalid or unsupported `timezone` string silently falls back to a locale-less format that omits one part, or if the user's browser returns unexpected part types, this throws `TypeError: Cannot read properties of undefined`. An invalid `timezone` in a user's profile would crash the entire History page. Add null-coalescing fallbacks or wrap in try/catch with UTC fallback.

---

**W82 — P3 — getSupportedTimezones: `new Set(...)` reconstructed on every render**
`apps/web/src/lib/web-data.ts:1015–1017`

```ts
return Array.from(new Set([currentTimezone, ...SUPPORTED_TIMEZONES]));
```

`SUPPORTED_TIMEZONES` is a module-level constant but `getSupportedTimezones(currentTimezone)` is called inside the settings hook on every render, rebuilding a full `Set` (600+ items) each time. Memoize with `useMemo` keyed on `currentTimezone`.

---

**W83 — P2 — WorkoutPreviewPage: Start Workout button not disabled during mutation**
`apps/web/src/pages/WorkoutPreviewPage.tsx`

The "Start Workout" `<button onClick={data.onStartWorkout}>` has no `disabled` prop tied to `startMutation.isPending`. A user who double-clicks or taps the button while the session creation request is in flight will fire two `POST /sessions` requests, creating duplicate sessions. Add `disabled={data.isStarting}` and expose `isStarting: startMutation.isPending` from the page data hook.

---

**W84 — P2 — WorkoutPreviewPage: `onStartWorkout` unhandled rejection**
`apps/web/src/pages/WorkoutPreviewPage.tsx`

`data.onStartWorkout` calls `mutateAsync(...)` internally. If `POST /sessions` fails, the rejection is unhandled at the call site, producing an uncaught promise rejection. Expose an `onStartWorkout` that catches internally and sets a local error state, or switch to `mutate` with `onError`.

---

**W85 — P3 — Template/completion query key mismatch causes duplicate cache entries**
`apps/web/src/lib/web-data.ts`

`useCompletionFlowData` fetches workout templates with the query key `['templates', 'completion']` while `useDashboardPageData` uses `['templates']`. These are treated as separate cache entries by TanStack Query; switching between Dashboard and Completion pages fires two redundant `GET /workout-templates` requests and maintains two independent stale timers. Use a single canonical key (e.g. `['workout-templates']`) everywhere.

---

**W86 — P2 — CompletionSummaryPage: no loading/error state; crashes on direct URL visit**
`apps/web/src/pages/CompletionSummaryPage.tsx`

The page reads `summary` exclusively from the Zustand store. On a direct URL visit (e.g., browser bookmark or page refresh) the store is rehydrated from `localStorage`, but `summary` will be `undefined` if no workout was just finished. The page renders with all zeros and no message explaining the empty state. Add a guard: if `summary` is undefined, redirect to `/dashboard` or show an explanatory empty state.

---

**W87 — P3 — ExerciseDetailPage navigation after wizard creates a broken flow**
`apps/web/src/pages/ExerciseWizardPage.tsx` / `apps/web/src/pages/ExerciseDetailPage.tsx`

After `createExercise` succeeds, the wizard navigates to `/exercise/${created.id}`. Because `ExerciseDetailPage` never loads data from the API (see W69), the user is taken to a page showing static placeholder content rather than the newly created exercise. Fix W69 first; the navigation target is otherwise correct.

---

## Key Outcomes

- The web app is no longer scaffold-only. Dashboard, history, settings, workout preview, completion flow, exercise selection/creation, and active workout state now read and write real API-backed data.
- Auth/session handling is materially stronger: client-side runtime response validation, refresh-token retry on 401, router-native login redirection, expired-session restoration in the guard, cached auth snapshots, and httpOnly refresh-cookie rotation are all in place.
- Workout streaks are now sourced from the API’s persisted streak service, history dates are localized to the user timezone, and active-workout mutations use modal-driven notes editing, atomic superset writes, server refresh syncing, and optimistic set completion.
- Pass 4 (2026-03-06) identified 20 new findings (W68–W87); 20 remain open. Two pages are fully unimplemented (TemplateBuilderPage — W71, ExerciseDetailPage — W69) and the ExerciseWizardPage wizard UX is non-functional (W68).

## Validation

```bash
pnpm --filter @irontrack/web test
pnpm --filter @irontrack/web typecheck
pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts
pnpm lint:code
pnpm format:check
```
