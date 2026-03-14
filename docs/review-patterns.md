# Code Review — Recurring Defect Patterns

This document captures the anti-patterns that recurred most often across the IronTrack review corpus (W1–W103, #1–#291, SH-1–14, E2E-1–17, I-1–12). Use it as a checklist when reviewing any new code path.

---

## P1 — High Impact

### P1-A: Pagination silently dropped at the API boundary

**Where found:** `web-api.ts` (fetchWorkoutTemplates, fetchExerciseHistory), `web-data.ts` (useHistoryPageData), exercises service history endpoint.

Paginated API responses are fetched once and the `items` array is consumed directly. Pages 2…N are never requested; callers have no idea data is truncated. The pattern is especially dangerous because the first page often has enough data to look correct in development.

**What to look for:**

- Any `apiFetch` call that parses a `{ items, pagination }` schema but the caller only uses `.items` without checking `pagination.total`.
- `useQuery` hooks whose `queryFn` never accepts or forwards a `page` parameter.
- UI components with no "load more" / infinite-scroll when the data source is paginated.

**Fix:** Either auto-paginate (fan-out `Promise.all` for known page count, see `listExercises`) or surface a "load more" control and pass the pagination metadata to the UI.

---

### P1-B: Serial async waterfall where parallel is possible

**Where found:** `web-api.ts:listExercises` — pages 2…N fetched in a `for…await` loop.

Sequential `await` inside a `for` loop is always a flag. Every iteration waits for the previous round-trip before issuing the next request, multiplying latency linearly with page count.

**What to look for:**

- `for (…) { await fetch(…) }` anywhere multiple independent requests are made.
- Any "fetch all pages" loop that does not use `Promise.all`.

**Fix:** Compute total pages from the first response, then `Promise.all(range(2..N).map(page => fetch(page)))`.

---

## P2 — Correctness / UX

### P2-A: Missing `userId` ownership guard in database queries

**Where found:** `volume.service.ts:calculateSessionVolume`, several early sessions service queries, PR-detection recalculate.

Prisma queries filter `deletedAt: null` but omit `userId` from `where`. Internal callers validate ownership upstream, but there is no defense-in-depth: a future caller that skips ownership validation silently reads or writes another user's data.

**What to look for:**

- Any `prisma.*.findMany` / `findUnique` that lacks `userId` in `where` when the model has a `userId` column.
- `session.findMany` filtered only by `id` or `deletedAt` without `userId`.

**Fix:** Always include `userId` in the `where` clause at the query level. Do not rely solely on upstream guards.

---

### P2-B: Count without distinct — satisfying a "one of each" requirement with duplicates

**Where found:** `streak.service.ts:onChecklistCompleted` — counts total items matching any required type, so completing one type 4× satisfies the ≥4 threshold.

Using `count({ where: { type: { in: [...TYPES] } } }) >= TYPES.length` is not equivalent to "all types present". A user who triggers the same type repeatedly can satisfy the threshold without ever touching the other types.

**What to look for:**

- Any `count()` query used to verify that a set of _distinct_ categories is fully covered.
- Checklist, milestone, or category-completion logic using `count >= N` without `groupBy` or per-type checks.

**Fix:** Either count with `groupBy` on the category field (`select: { _count: { type: true } }`) or run N individual existence checks and require all to return a result.

---

### P2-C: Zero-value guard too broad — valid zero-weight data silently excluded

**Where found:** `pr-detection.service.ts:replaceIfHigher` — `if (value <= 0) return` skips MAX_VOLUME and MAX_1RM_EST for bodyweight/reps-only exercises where `weight = 0`.

Guarding against negative/zero inputs makes sense for nonsensical data, but many legitimate exercise types have `weight = 0`. Applying the same guard to derived metrics (volume = weight × reps) blocks valid records.

**What to look for:**

- Any PR, leaderboard, or record-tracking logic that skips entries based on a raw `value <= 0` check without considering whether zero is a valid domain value for that exercise type.
- Computed metrics (volume, 1RM estimate) that inherit the guard from an input check.

**Fix:** Separate guards by domain meaning. Zero weight is valid for bodyweight exercises; only negative values or structurally impossible combinations (e.g. 0 reps) should be skipped.

---

### P2-D: `start()` vs `syncFromServer()` — state-preserving vs state-resetting store actions

**Where found:** `web-data.ts:useExerciseSelectPageData` — calls `start()` after a swap, clearing the rest timer.

`start()` is designed for a brand-new session: it zeros out `restTimerSeconds`, `restTimerEndsAt`, and `restTimerActive`. `syncFromServer()` updates exercises while preserving timer state when the session ID is unchanged. Using `start()` mid-session clears any active rest countdown without warning.

**What to look for:**

- Any code path that refreshes session exercises from the server _mid-workout_ (swap, notes save, superset apply) and calls `start()` instead of `syncFromServer()`.

**Fix:** Use `syncFromServer()` for all mid-session server syncs; `start()` only on initial workout launch.

---

### P2-E: Async mutation errors silently discarded — no path to `setErrorMessage`

**Where found:** `web-data.ts:onDeleteAccount` — `await deleteCurrentUser()` has no try/catch; the error bubbles to an unhandled rejection and `setErrorMessage` is never called.

A missing try/catch around an async operation in an event handler means any failure is invisible to the user. The UI stays in the pre-error state with no feedback.

**What to look for:**

- `onClick` / `onSubmit` async handlers that `await` an API call without wrapping it in try/catch.
- `finally` blocks that assume the preceding `await` succeeded (e.g. calling `navigate` unconditionally).
- Any `setErrorMessage` that can only be reached inside a different try/catch than the failing `await`.

**Fix:** Wrap every top-level async handler in try/catch; call `setErrorMessage` in the catch branch.

---

### P2-F: Guard redirect targets that create dead ends

**Where found:** `App.tsx:RequireCompletedWorkout` — redirects to `/workout/active`; if no active session exists that page shows "No active session" with no forward navigation.

Route guards that redirect to a page which itself has no valid content for the user create navigation traps.

**What to look for:**

- `<Navigate to="..." />` inside a guard component — verify the target page has meaningful content for a user who arrives without the required state.
- Completion-flow guards redirecting to active-workout pages.
- Auth guards redirecting to pages that require auth without first redirecting to login.

**Fix:** Default guard redirects to a safe "always valid" page (e.g. `/` dashboard or `/login`) unless the target is guaranteed to have meaningful content.

---

### P2-G: Non-deterministic ordering from input-sequence tiebreaking

**Where found:** `superset.service.ts:interleave` — when two units share the same `orderIndex`, the tie resolves by `sequence` (position in the caller's input array). Different callers produce different orderings for the same data.

**What to look for:**

- Sort comparators with a tiebreaker that depends on array position (`a.sequence - b.sequence` where sequence is derived from `entries.map((e, i) => i)`).
- Any ordering logic where the result differs depending on which caller assembles the input array.

**Fix:** Use a stable, DB-backed secondary sort key (e.g. `id` or `createdAt`) instead of input-array position.

---

### P2-H: Hardcoded `[0]` index instead of context-driven selection

**Where found:** `ActiveWorkoutPage.tsx` — Overflow button always passes `exercises[0]?.id`; no per-exercise trigger exists.

Hardcoding the first array element is a common placeholder that survives past its intended lifetime and silently limits functionality to the first item.

**What to look for:**

- `items[0]` passed as an argument to an action handler rather than derived from user interaction context.
- Single action buttons that operate on a list but have no mechanism to target individual items.

**Fix:** Thread the item identifier through the interaction (e.g. per-row buttons) instead of defaulting to the first element.

---

### P2-J: Extra database round-trip inside a hot path due to missing caller-provided context

**Where found:** `streak.service.ts:resolveTimezone` — fetches the user record on every `incrementStreak` call when `timezone` is omitted, even though callers often already hold the user object.

**What to look for:**

- Service methods with optional parameters that trigger a fallback DB lookup.
- Callers that have the required value (e.g. `user.timezone`) but do not pass it, forcing the service to re-query.

**Fix:** Make callers responsible for passing values they already have; reserve the fallback lookup for cases where the value is genuinely unavailable at the call site.

---

## P3 — Maintainability / Reliability

### P3-A: Fragile enum-to-label mapping via string manipulation

**Where found:** `web-data.ts:formatExerciseTypeLabel` — splits on `_`, joins with `+`, then patches known edge cases with `.replace()`. Any new enum value not covered breaks the output with stray `+` tokens.

**What to look for:**

- `enumValue.split('_').join(' ').replace(...)` patterns used to produce display labels.
- Label functions with hardcoded `.replace('X', 'Y')` chains — each entry is a future maintenance bomb.

**Fix:** Use an explicit `Record<EnumValue, string>` map. TypeScript will surface exhaustiveness errors when a new enum value is added.

---

### P3-B: EPSILON / numerical-correctness guards with wrong magnitude

**Where found:** `completion.service.ts:completionPercent` — `Number.EPSILON ≈ 2.22e-16` is added before a `× 100` scaling, producing a nudge of `2.22e-14` at the final precision level — 14 orders of magnitude below what matters.

**What to look for:**

- `+ Number.EPSILON` combined with subsequent multiplication that scales the epsilon away.
- Float-rounding guards that are applied at the wrong step in a multi-step formula.

**Fix:** Apply the epsilon at the final step (`Math.round(value + Number.EPSILON)`), or use a purpose-fit epsilon (`5e-5` for two-decimal rounding).

---

### P3-C: Raw values displayed without units or formatting

**Where found:** `CompletionSummaryPage.tsx` — `summary.durationSeconds` rendered as "Duration: 3600s"; `summary.totalVolume` without separators or unit label.

**What to look for:**

- Any JSX that interpolates a number from the store or API directly (`{value}`) without passing it through a format helper.
- Duration fields (seconds, minutes) rendered as plain integers.
- Volume / weight fields without unit labels (kg/lb) or thousands separators.

**Fix:** Pass all user-facing numbers through the appropriate format helper (`formatDurationLabel`, `formatNumber`, `formatWeight`, etc.) before rendering.

---

### P3-D: Unstable / experimental API surface from third-party libraries

**Where found:** `SettingsPage.tsx:unstable_usePrompt`.

`unstable_` (React Router), `experimental_` (React), and similar prefixes explicitly signal that the API is subject to removal or breaking changes without a semver bump.

**What to look for:**

- Imports of `unstable_*` or `experimental_*` symbols from React Router, React, or other libraries.
- Usage of APIs documented as "not recommended for production".

**Fix:** Track stable alternatives; add a comment linking to the library issue/RFC so future reviewers know the status.

---

### P3-E: Mutation of only a subset of a list, silently reordering non-mutated items

**Where found:** `web-data.ts:onMoveExercise` — reconstructs the list as `[...selected, ...unselected]`, permanently pushing all unselected exercises to the bottom.

**What to look for:**

- Filter-then-rejoin patterns (`items.filter(pred)` concatenated with `items.filter(!pred)`) that change the relative order of items outside the mutation target.
- Reorder / move functions that operate on a filtered subset of a list and then splice the results back in a way that affects non-targeted items.

**Fix:** Perform the move within the full list and preserve the position of unaffected items.

---

### P3-F: Duration/count labels with missing edge-case ranges

**Where found:** `web-data.ts:formatDurationLabel` — clamps below 1 minute to "1m"; never shows hours for long sessions.

**What to look for:**

- Duration format functions that only handle one unit (minutes) without a floor for < 60s or a ceiling for > 60m.
- Count/distance labels that use a fixed unit without scaling to higher orders of magnitude.

**Fix:** Test the formatter with 0s, 30s, 59s, 60s, 3599s, 3600s, 7200s and verify each renders sensibly.

---

## Summary by Area

| Area                   | Most common pattern                                                           |
| ---------------------- | ----------------------------------------------------------------------------- |
| Prisma queries         | P2-A (missing userId), P2-B (count not distinct)                              |
| Domain services        | P2-C (zero-value guard), P2-J (extra DB lookup), P3-B (EPSILON scale)         |
| Zustand / client state | P2-D (start vs syncFromServer), P3-E (subset mutation reorders list)          |
| API fetch layer        | P1-A (pagination dropped), P1-B (serial waterfall)                            |
| React event handlers   | P2-E (errors discarded), P2-H (hardcoded [0])                                 |
| Routing / guards       | P2-F (dead-end redirect)                                                      |
| Rendering              | P3-C (raw values), P3-F (label edge cases)                                    |
| Data modelling helpers | P2-G (non-deterministic sort), P3-A (fragile string map), P3-D (unstable API) |
