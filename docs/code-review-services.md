# Code Review — Domain Services

**Branch:** `phase_one`
**Date:** 2026-03-05
**Scope:**

- `apps/api/src/services/completion.service.ts` + `.spec.ts`
- `apps/api/src/services/pr-detection.service.ts` + `.spec.ts`
- `apps/api/src/services/streak.service.ts` + `.spec.ts`
- `apps/api/src/services/superset.service.ts` + `.spec.ts`
- `apps/api/src/services/volume.service.ts` + `.spec.ts`
- `apps/api/src/common/utils/volume.ts`

---

## Summary

Five domain services reviewed: `CompletionService` (36 lines), `PrDetectionService` (279 lines), `StreakService` (120 lines), `SupersetService` (61 lines), `VolumeService` (43 lines). Most logic is correct. The two most significant issues are in `PrDetectionService`: sequential upserts without a transaction (P1) and provenance data loss in `recalculateForExercise` (P2).

---

## Findings

### P1 — Must Fix

#### 1. `PrDetectionService.detectForSession` — N sequential upserts without a transaction (`pr-detection.service.ts:106–129`)

```ts
for (const [exerciseTemplateId, sets] of grouped.entries()) {
  const candidateMap = this.calculateCandidates(sets);
  for (const [prType, candidate] of candidateMap.entries()) {
    if (!candidate) continue;
    // ...
    await this.prisma.pRRecord.upsert({ ... }); // ← one round-trip per PR improvement
    existingValueByKey.set(prKey, candidate.value);
    createdPrs.push({ ... });
  }
}
```

Each PR improvement is committed individually. If a transient DB error occurs after the third upsert of eight, the first three exercises have updated PRs in the DB and the remaining five do not. The function throws, the caller sees an error, and the PR table is left in a half-updated state with no way to determine which exercises were processed.

There is also no transaction boundary protecting the `existingValueByKey` in-memory map: it is partially advanced, so a retry within the same call stack would operate on stale in-memory state.

**Fix:** Collect all upsert operations into an array and run them in a single `prisma.$transaction([...])`:

```ts
const upserts: ReturnType<typeof this.prisma.pRRecord.upsert>[] = [];

for (const [exerciseTemplateId, sets] of grouped.entries()) {
  const candidateMap = this.calculateCandidates(sets);
  for (const [prType, candidate] of candidateMap.entries()) {
    if (!candidate) continue;
    const prKey = this.getPrKey(exerciseTemplateId, prType);
    const existingValue = existingValueByKey.get(prKey);
    if (existingValue === undefined || candidate.value > existingValue) {
      upserts.push(this.prisma.pRRecord.upsert({ ... }));
      createdPrs.push({ ... });
    }
  }
}

await this.prisma.$transaction(upserts);
```

---

### P2 — Should Fix

#### 2. `PrDetectionService.recalculateForExercise` — `sessionId` absent from both `update` and `create` payloads (`pr-detection.service.ts:188–200`)

```ts
// recalculateForExercise (L188–200)
update: {
  value: candidate.value,
  achievedAt: candidate.achievedAt,
  setId: candidate.setId,
  // ← sessionId missing
},
create: {
  userId,
  exerciseTemplateId,
  prType,
  value: candidate.value,
  achievedAt: candidate.achievedAt,
  setId: candidate.setId,
  // ← sessionId missing
},

// detectForSession (L113–128) — correct
update: { value, achievedAt, setId, sessionId },
create: { userId, exerciseTemplateId, prType, value, achievedAt, setId, sessionId },
```

`sessionId` is `String? @db.Uuid` in the `PRRecord` schema, so this does not cause a runtime error. However:

- **`create`**: New PR records created by `recalculateForExercise` have `sessionId: null`, silently losing the provenance link to the session where the PR was achieved.
- **`update`**: When a recalculation updates an existing record, the `sessionId` retains its old value — potentially pointing to a different session than the one that actually contains the best set.

`detectForSession` consistently populates `sessionId`. The omission in `recalculateForExercise` appears unintentional.

**Fix:** Pass `sessionId` to both `update` and `create` in `recalculateForExercise`. The method already receives `exerciseTemplateId` but not `sessionId` — it would need to be fetched from the best set's session or passed as a parameter. Since `recalculateForExercise` works across all sets (not a single session), the appropriate value is the `sessionId` of the set that produced the winning candidate for each PR type.

---

#### 3. `PrDetectionService.recalculateForExercise` — stale PR records never deleted when all candidates are invalid (`pr-detection.service.ts:169–202`)

```ts
for (const prType of [PrType.MAX_WEIGHT, PrType.MAX_REPS, PrType.MAX_VOLUME, PrType.MAX_1RM_EST]) {
  const candidate = candidates.get(prType);
  if (!candidate) {
    continue; // ← stale DB record left untouched
  }
  await this.prisma.pRRecord.upsert({ ... });
}
```

When a user deletes all sets for an exercise, or all remaining sets have `weight: 0` and `reps: 0`, `calculateCandidates` returns all-null candidates. Every PR type hits `continue` and no DB write occurs. Existing `PRRecord` rows for that exercise persist with stale values that no longer reflect the user's data.

**Fix:** Add a `deleteMany` for PR types where `candidate` is null:

```ts
const nullTypes = [...candidates.entries()]
  .filter(([, c]) => !c)
  .map(([type]) => type);

if (nullTypes.length > 0) {
  await this.prisma.pRRecord.deleteMany({
    where: { userId, exerciseTemplateId, prType: { in: nullTypes } },
  });
}
```

---

#### 4. `StreakService.onSessionFinished` — streak date derived from server wall clock, not session completion time (`streak.service.ts:18`, `48`)

```ts
async onSessionFinished(userId: string): Promise<void> {
  await this.incrementStreak(userId, StreakType.WORKOUT);
  // ← no session timestamp passed
}

// inside incrementStreak:
const localDate = forcedDate ?? this.formatDateInTimezone(new Date(), timezone);
//                                                         ^^^^^^^^^^^
//                                                         current server time
```

`onSessionFinished` takes only a `userId`. `incrementStreak` uses `new Date()` (the server's current time) to determine which calendar day counts for the streak. If the method is called asynchronously after a delay — e.g., from a background job, after an offline sync, or via a retry queue — the streak records the day the job ran rather than the day the session was completed. A session finished at 23:58 could have its streak credit recorded on the following day if the job runs after midnight.

The `checklist` path already has the correct pattern: `onChecklistCompleted(userId, date)` passes the date explicitly, which is passed as `forcedDate` to `incrementStreak`.

**Fix:** Add an optional `completedAt?: Date` parameter to `onSessionFinished` and forward it as `forcedDate` after converting to the user's timezone:

```ts
async onSessionFinished(userId: string, completedAt?: Date): Promise<void> {
  await this.incrementStreak(userId, StreakType.WORKOUT, completedAt);
}
```

---

#### 5. `VolumeService.cacheSessionVolume` — unhandled Prisma P2025 when session does not exist (`volume.service.ts:36–38`)

```ts
await this.prisma.workoutSession.update({
  where: { id: sessionId },
  data: { totalVolume },
});
```

If `sessionId` does not exist in the DB (deleted, wrong ID, or race condition), Prisma throws `PrismaClientKnownRequestError` with code `P2025` ("An operation failed because it depends on one or more records that were required but not found"). The error is uncaught and propagates to the caller as an unhandled exception. If `cacheSessionVolume` is called in a fire-and-forget context, the rejection is silently swallowed; if called in a request handler, it surfaces as a 500.

**Fix:** Either use `updateMany` (which silently no-ops on missing records) or add explicit error handling:

```ts
await this.prisma.workoutSession.updateMany({
  where: { id: sessionId },
  data: { totalVolume },
});
```

---

### P3 — Nice to Have

#### 6. `PrDetectionService.calculateCandidates` — O(n²) array allocation in grouped accumulation (`pr-detection.service.ts:53–56`)

```ts
grouped.set(exerciseTemplateId, [
  ...(grouped.get(exerciseTemplateId) ?? []),
  record,
]);
```

Spread on every push creates a new array for each set, O(n²) for n sets per exercise. Should initialize with `[]` and push in place:

```ts
if (!grouped.has(exerciseTemplateId)) {
  grouped.set(exerciseTemplateId, []);
}
grouped.get(exerciseTemplateId)!.push(record);
```

---

#### 7. `PrDetectionService.calculateCandidates` — `completedAt ?? new Date()` silently uses current time for completed sets with null timestamp (`pr-detection.service.ts:217`)

```ts
const achievedAt = set.completedAt ?? new Date();
```

The query that feeds `calculateCandidates` filters `isCompleted: true`. A completed set should always have a `completedAt` value — `null` here indicates a data integrity problem, not a normal case. Silently substituting `new Date()` records the PR as achieved at the current server time, which is incorrect and undetectable in the audit trail.

**Fix:** Log a warning or surface the anomaly rather than silently substituting:

```ts
if (!set.completedAt) {
  // Data integrity issue: completed set has no completedAt timestamp.
  // Log and skip to avoid recording a misleading PR timestamp.
  continue;
}
const achievedAt = set.completedAt;
```

---

#### 8. `SupersetService.interleave` — non-deterministic ordering when two groups share the same minimum `orderIndex` (`superset.service.ts:46–48`)

```ts
return [...singleUnits, ...groupUnits]
  .sort((a, b) => a.orderIndex - b.orderIndex)
  .flatMap((unit) => unit.items);
```

If two superset groups both have their first item at the same `orderIndex`, their relative position in the output depends on insertion order in the `Map` and the stability of the runtime's sort algorithm. JavaScript's `Array.prototype.sort` is stable in V8 since Node 11, but the behaviour is undefined by the spec when comparator returns 0. Untested and undocumented.

---

#### 9. `CompletionService.calculate` — `completionPercent` not rounded (`completion.service.ts:26–27`)

```ts
const completionPercent =
  totalSets === 0 ? 0 : (completedSets / totalSets) * 100;
```

Returns a raw floating-point value for non-exact divisions (e.g., 1 completed of 3 total → `33.333...`). If this value is stored in the DB or returned in an API response without rounding, consumers receive inconsistent precision. The spec only tests exact-division cases (0/0, 6/8).

---

#### 10. Missing test coverage across services

| Service              | Missing scenario                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `CompletionService`  | `completedSets === totalSets` with `totalSets > 0` (all sets complete, `isIncomplete: false`, non-zero case) |
| `PrDetectionService` | `existingValue === undefined` branch in `detectForSession` (new PR with no prior record for that type)       |
| `PrDetectionService` | Multiple exercises in a single session (grouping logic)                                                      |
| `PrDetectionService` | `detectForSession` with both improving and non-improving PR types in the same session                        |
| `StreakService`      | `currentStreakDays` exceeds `longestStreakDays` — `longestStreakDays` is updated to the new count            |
| `StreakService`      | `daysBetween` called with `prev > next` (returns negative — `isConsecutive = false`)                         |
| `SupersetService`    | Empty input array                                                                                            |
| `SupersetService`    | Multiple independent superset groups in one call                                                             |

---

## Verification Pass 1 — 2026-03-05

496 tests pass across 55 suites (`pnpm test:api`).

| #   | Finding                                                                        | Status   | Notes                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `detectForSession` — sequential upserts without a transaction                  | ✅ Fixed | Upserts collected into `upserts[]` array; `this.prisma.$transaction(upserts)` called once at `pr-detection.service.ts:148–150`                                                 |
| 2   | `recalculateForExercise` — `sessionId` missing from update/create              | ✅ Fixed | `ExerciseSetInput` gains `sessionId: string \| null`; query selects `sessionExercise.sessionId`; both `update` and `create` payloads include `candidate.sessionId` (L214, 223) |
| 3   | `recalculateForExercise` — stale PRs not deleted when all candidates are null  | ✅ Fixed | `nullPrTypes[]` collected; `deleteMany` called when non-empty at `pr-detection.service.ts:228–236`                                                                             |
| 4   | `onSessionFinished` — streak date from wall clock, not session timestamp       | ✅ Fixed | `onSessionFinished(userId, completedAt?: Date)`; `incrementStreak` accepts `string \| Date`; Date inputs formatted via user timezone (L48–50)                                  |
| 5   | `cacheSessionVolume` — unhandled Prisma P2025 on missing session               | ✅ Fixed | Changed `update` → `updateMany` at `volume.service.ts:36`; no-ops silently on missing session                                                                                  |
| 6   | O(n²) array spread in grouped accumulation                                     | ✅ Fixed | Now uses `existingGroup.push(record)` pattern at `pr-detection.service.ts:55–60`                                                                                               |
| 7   | `completedAt ?? new Date()` silently masks data integrity issue                | ✅ Fixed | Sets with null `completedAt` are skipped with an explanatory comment at `pr-detection.service.ts:256–260`                                                                      |
| 8   | Non-deterministic ordering when two groups share the same minimum `orderIndex` | ✅ Fixed | `sequence` field tracks original insertion index; sort uses `sequence` as tiebreaker at `superset.service.ts:65–69`                                                            |
| 9   | `completionPercent` not rounded                                                | ✅ Fixed | Rounded to 2 decimal places using epsilon-guard pattern at `completion.service.ts:27–31`                                                                                       |
| 10  | Missing test coverage across services                                          | ✅ Fixed | New tests added in all five spec files; 496 total tests pass                                                                                                                   |

---

## New Findings — 2026-03-05 (Pass 1)

### P1 — Must Fix

#### 11. `PrDetectionService.recalculateForExercise` — sequential upserts and `deleteMany` not wrapped in a transaction (`pr-detection.service.ts:202–236`)

```ts
for (const prType of [...]) {
  const candidate = candidates.get(prType);
  if (!candidate) {
    nullPrTypes.push(prType);
    continue;
  }
  await this.prisma.pRRecord.upsert({ ... }); // ← awaited individually in loop
}

if (nullPrTypes.length > 0) {
  await this.prisma.pRRecord.deleteMany({ ... }); // ← separate await
}
```

The fix for finding #1 wrapped `detectForSession` upserts in a `$transaction`, but `recalculateForExercise` still awaits each upsert individually inside the loop. The same partial-failure risk applies: a transient error after the second upsert leaves some PR types updated and others not. Worse, the `deleteMany` for null PR types runs as a separate operation after the loop — if any upsert throws, the `deleteMany` never executes, leaving stale records that finding #3 was meant to eliminate.

**Fix:** Collect upserts into an array and run them together with `deleteMany` in a single transaction:

```ts
const upsertOps: Array<ReturnType<typeof this.prisma.pRRecord.upsert>> = [];

for (const prType of [...]) {
  const candidate = candidates.get(prType);
  if (!candidate) {
    nullPrTypes.push(prType);
    continue;
  }
  upsertOps.push(this.prisma.pRRecord.upsert({ ... }));
}

await this.prisma.$transaction([
  ...upsertOps,
  ...(nullPrTypes.length > 0
    ? [this.prisma.pRRecord.deleteMany({ where: { userId, exerciseTemplateId, prType: { in: nullPrTypes } } })]
    : []),
]);
```

---

## Verification Pass 2 — 2026-03-05

| #   | Finding                                                                           | Status       | Notes                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | `recalculateForExercise` — sequential upserts + `deleteMany` not in a transaction | ❌ Not Fixed | `pr-detection.service.ts:202–226` still awaits each `pRRecord.upsert` individually inside the loop; `deleteMany` at L229–236 remains a separate `await`. Spec tests for `recalculateForExercise` also lack a `$transaction` mock, confirming the implementation has not changed. |

---

## New Findings — 2026-03-05 (Pass 2)

### P1 — Must Fix

#### 11. _(Carried from Pass 1 — still open)_ `PrDetectionService.recalculateForExercise` — sequential upserts and `deleteMany` not wrapped in a transaction

See finding #11 above.

---

### P2 — Should Fix

#### 12. `StreakService.formatDateInTimezone` — invalid timezone string throws uncaught `RangeError` (`streak.service.ts:103–111`)

```ts
const timezone = user.timezone ?? 'UTC';
// ...
private formatDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, // ← throws RangeError for invalid strings
    // ...
  });
  return formatter.format(date);
}
```

`user.timezone ?? 'UTC'` guards against `null`/`undefined` but not against invalid timezone strings (e.g., `'garbage'`, `'EST5EDT'`, values stored via a legacy or unvalidated code path). `new Intl.DateTimeFormat` with an unrecognised `timeZone` throws `RangeError: Invalid time zone specified`. The error propagates out of `incrementStreak` as an unhandled exception, causing the streak update to fail entirely for that user.

**Fix:** Fall back to `'UTC'` on `RangeError`:

```ts
private formatDateInTimezone(date: Date, timezone: string): string {
  let tz = timezone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
```

Alternatively, validate timezone at write time (user creation/update DTO) so invalid values never reach the DB.

---

#### 13. `recalculateForExercise` spec tests incompatible with `$transaction` fix (`pr-detection.service.spec.ts:385–584`)

```ts
// recalculates and upserts current PRs for one exercise (L385–483)
const prismaMock = {
  set: { findMany: jest.fn(...) },
  pRRecord: {
    upsert: jest.fn(async () => undefined),     // ← direct mock
    deleteMany: jest.fn(async () => ({ count: 0 })),
    // ← no $transaction mock
  },
} as unknown as PrismaService;
```

All three `recalculateForExercise` tests mock `pRRecord.upsert` and `pRRecord.deleteMany` directly but do not include a `$transaction` mock. When finding #11 is fixed (operations collected into an array and dispatched via `$transaction`), calling `this.prisma.$transaction(...)` will throw `TypeError: this.prisma.$transaction is not a function`, failing every test in this block.

The existing assertions also target individual `upsert` calls (`expect(prismaMock.pRRecord.upsert).toHaveBeenCalledWith(...)`). After the fix, assertions should instead verify that `$transaction` receives an array of the expected operations.

**Fix:** Add `$transaction: jest.fn(async (ops) => Promise.all(ops))` to each `recalculateForExercise` test mock and update assertions to match the transactional call pattern used in the `detectForSession` tests.

---

### P3 — Nice to Have

#### 14. `StreakService.onChecklistCompleted` — exact equality `=== 4` silently misses when duplicate checklist entries exist (`streak.service.ts:31`)

```ts
if (completedCount === REQUIRED_CHECKLIST_TYPES.length) {
```

If the `checklistItem` table lacks a `@@unique([userId, date, type])` constraint, a user can have two completed `WORKOUT` items on the same date. The count would then be 5, and `=== 4` would not fire, silently preventing the streak from incrementing even though all four required types are complete.

**Fix:** Use `>=`:

```ts
if (completedCount >= REQUIRED_CHECKLIST_TYPES.length) {
```

This is a no-op when the schema enforces uniqueness but becomes correct if the constraint is ever relaxed.

---

## Verification Pass 3 — 2026-03-05

| #   | Finding                                                                         | Status   | Notes                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11  | `recalculateForExercise` — sequential upserts + `deleteMany` not in transaction | ✅ Fixed | Operations collected into `operations[]` (L188–191); `deleteMany` pushed when `nullPrTypes` non-empty (L234–243); `$transaction(operations)` called at L246. Spec tests (L385–602) include `$transaction` mock and assert call count and array length. |
| 12  | `formatDateInTimezone` — invalid timezone throws uncaught `RangeError`          | ✅ Fixed | `try/catch` added at `streak.service.ts:103–120`; catches error and falls back to UTC formatter. Test "falls back to UTC when timezone value is invalid" added at `streak.service.spec.ts:421–455`.                                                    |
| 13  | `recalculateForExercise` spec tests incompatible with `$transaction` fix        | ✅ Fixed | All three tests now include `$transaction: jest.fn(...)` mock and assert `toHaveBeenCalledTimes(1)` plus `toHaveLength(4/2/1)`.                                                                                                                        |
| 14  | `onChecklistCompleted` — `=== 4` should be `>= 4`                               | ✅ Fixed | Changed to `>=` at `streak.service.ts:31`. New test "increments checklist streak when completed count exceeds required checklist types" (spec L388–419) exercises `count = 5` path.                                                                    |

---

## New Findings — 2026-03-05 (Pass 3)

### P2 — Should Fix

#### 15. `StreakService.incrementStreak` — TOCTOU race condition between `findUnique` and `create` (`streak.service.ts:53–73`)

```ts
const streak = await this.prisma.userStreak.findUnique({
  where: { userId_streakType: { userId, streakType } },
});

if (!streak) {
  await this.prisma.userStreak.create({    // ← P2002 if concurrent call wins the race
    data: { userId, streakType, currentStreakDays: 1, ... },
  });
  return;
}
```

If two requests invoke `incrementStreak` concurrently for the same `(userId, streakType)` — e.g., a retry from a failed job, a double-tap on the client, or two background handlers running in parallel — both calls can read `null` from `findUnique` and both then attempt `create`. The second `create` hits the unique constraint on `(userId, streakType)` and throws `PrismaClientKnownRequestError` with code `P2002`. This error is uncaught and propagates to the caller.

`sessions.service.ts:193` correctly passes `finishedAt` to `onSessionFinished`, so this is a pure concurrency issue, not a data problem.

**Fix:** Catch the `P2002` from `create` and treat it as a same-day idempotent call:

```ts
import { Prisma } from '@prisma/client';

try {
  await this.prisma.userStreak.create({
    data: {
      userId,
      streakType,
      currentStreakDays: 1,
      longestStreakDays: 1,
      lastCompletedDate: dateValue,
    },
  });
} catch (err) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return; // concurrent insert already created it — treat as idempotent
  }
  throw err;
}
return;
```

---

### P3 — Nice to Have

#### 16. `detectForSession` — "skips candidate types" test missing `$transaction` mock and negative assertion (`pr-detection.service.spec.ts:136–167`)

```ts
// No $transaction in mock, no expect(...).not.toHaveBeenCalled() assertion.
const prismaMock = {
  set: { findMany: jest.fn(...) },
  pRRecord: { findMany: jest.fn(...), upsert: jest.fn(...) },
  // ← $transaction absent
} as unknown as PrismaService;
```

The "skips candidate types with non-positive values" test omits `$transaction` from the mock. If the `if (upserts.length > 0)` guard were accidentally removed, `$transaction(...)` would throw `TypeError: this.prisma.$transaction is not a function`, surfacing as a cryptic runtime error rather than a clean assertion failure. The pattern in "ignores completed sets without completedAt" (`expect(prismaMock.$transaction).not.toHaveBeenCalled()`) is more explicit and should be applied here too.

**Fix:** Add `$transaction: jest.fn()` to the mock and assert `expect(prismaMock.$transaction).not.toHaveBeenCalled()`.
