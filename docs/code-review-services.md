# Code Review — Domain Services (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-05  
**Scope:**

- `apps/api/src/services/completion.service.ts` + `.spec.ts`
- `apps/api/src/services/pr-detection.service.ts` + `.spec.ts`
- `apps/api/src/services/streak.service.ts` + `.spec.ts`
- `apps/api/src/services/superset.service.ts` + `.spec.ts`
- `apps/api/src/services/volume.service.ts` + `.spec.ts`
- `apps/api/src/common/utils/volume.ts`
- `apps/api/src/modules/sessions/sessions.service.ts` + `.spec.ts`
- `apps/api/src/modules/checklist/checklist.service.ts` + `.spec.ts`
- `apps/api/src/modules/exercises/exercises.service.ts` + `.spec.ts`
- `apps/api/src/modules/progress/progress.service.ts` + `.spec.ts`
- `apps/api/src/modules/users/users.service.ts` + `.spec.ts`
- `apps/api/src/modules/workout-templates/workout-templates.service.ts` + `.spec.ts`
- `apps/api/src/modules/auth/auth.service.ts` + `.spec.ts`
- `apps/api/src/modules/catalog/catalog.service.ts` + `.spec.ts`
- `apps/api/src/modules/ml-client/ml-client.service.ts` + `.spec.ts`

---

## Current Status

- Total findings tracked: **78**
- Open findings: **0**
- Fixed findings: **78**
- Historical implementation snippets were removed to keep this document compact.

---

## Findings Index

- `#1–#28`: ✅ Fixed (covered in prior passes; retained as fixed history)
- `#29`: ✅ Fixed — `softDeleteSession` now recalculates PRs for affected exercise templates.
- `#30`: ✅ Fixed — `deleteSessionExercise` now recalculates PRs and recaches volume for finished sessions.
- `#31`: ✅ Fixed — `swapSessionExercise` now recalculates PRs for both old and new templates.
- `#32`: ✅ Fixed — `updateSet` now recalculates PRs only when PR-affecting fields change.
- `#33`: ✅ Fixed — `reorderSessionExercises` now pre-validates target IDs before applying updates.
- `#34`: ✅ Fixed — `createSetInternal` now handles idempotency `P2002` races by refetching existing rows.
- `#35`: ✅ Fixed — `finishSession` now runs side-effect computation before persisting `FINISHED` status.
- `#36`: ✅ Fixed — set mutation lookups now require `session.deletedAt: null`.
- `#37`: ✅ Fixed — `ChecklistService.upsert` now forwards timezone to streak updates.
- `#38`: ✅ Fixed — `batchCreateSets` now creates sets in parallel.
- `#39`: ✅ Fixed — `CompletionService.calculate()` now excludes sets from soft-deleted sessions.
- `#40`: ✅ Fixed — `VolumeService.calculateSessionVolume()` now excludes sets from soft-deleted sessions.
- `#41`: ✅ Fixed — `ProgressService.weekly()` now excludes soft-deleted sessions and session exercises.
- `#42`: ✅ Fixed — `ExercisesService.history()` now excludes soft-deleted sessions and session exercises.
- `#43`: ✅ Fixed — `SessionsService.getActiveSession()` now applies superset interleaving just like `getSession()`.
- `#44`: ✅ Fixed — `WorkoutTemplatesService.reorder()` now pre-validates accessible template IDs before writing.
- `#45`: ✅ Fixed — `UsersService.getMe()` now returns only active users.
- `#46`: ✅ Fixed — `UsersService.updateMe()` now rejects deleted or missing users with `USER_NOT_FOUND`.
- `#47`: ✅ Fixed — `UsersService.deleteMe()` now guards the root user write before fan-out deletes.
- `#48`: ✅ Fixed — `StreakService.resolveTimezone()` now stops streak writes for soft-deleted users.
- `#49`: ✅ Fixed — `SessionsService.startSession()` now clones only active template exercises.
- `#50`: ✅ Fixed — `SessionsService.startSession()` now returns superset-interleaved exercises.
- `#51`: ✅ Fixed — `SessionsService.listSessions()` now nulls soft-deleted workout templates.
- `#52`: ✅ Fixed — `updateSet()` now requires `sessionExercise.deletedAt: null`.
- `#53`: ✅ Fixed — `deleteSet()` now requires `sessionExercise.deletedAt: null`.
- `#54`: ✅ Fixed — `toggleSetCompletion()` now requires `sessionExercise.deletedAt: null`.
- `#55`: ✅ Fixed — `WorkoutTemplatesService.list()` now excludes deleted exercise rows.
- `#56`: ✅ Fixed — `WorkoutTemplatesService.getById()` now excludes deleted exercise rows from both payload and `muscleCoverage`.
- `#57`: ✅ Fixed — `AuthService.googleLogin()` now normalizes verified Google emails before matching or creating users.
- `#58`: ✅ Fixed — `ChecklistService.upsert()` now preserves the original `completedAt` for already-completed items.
- `#59`: ✅ Fixed (`P1`) — `AuthService.register()` now trims emails before lookup and persistence.
- `#60`: ✅ Fixed (`P2`) — `AuthService.login()` now trims emails before lookup.
- `#61`: ✅ Fixed (`P2`) — `ExercisesService.create()` now deduplicates `secondaryMuscleGroupIds`.
- `#62`: ✅ Fixed (`P2`) — `ExercisesService.create()` now deduplicates `equipmentIds`.
- `#63`: ✅ Fixed (`P2`) — `ExercisesService.update()` now deduplicates `secondaryMuscleGroupIds`.
- `#64`: ✅ Fixed (`P2`) — `ExercisesService.update()` now deduplicates `equipmentIds`.
- `#65`: ✅ Fixed (`P3`) — `ExercisesService.history()` now pushes null `completedAt` rows behind completed history.
- `#66`: ✅ Fixed (`P3`) — `CatalogService.muscleGroups()` now sorts null `sortOrder` rows last.
- `#67`: ✅ Fixed (`P3`) — `CatalogService.equipment()` now sorts null `sortOrder` rows last.
- `#68`: ✅ Fixed (`P4`) — `MlClientService.resolveBasePath()` now strips repeated trailing slashes.
- `#69`: ✅ Fixed (`P1`) — `SessionsService.updateSession()` now enforces optimistic version checks atomically at write time.
- `#70`: ✅ Fixed (`P2`) — `SessionsService.addSessionExercise()` now maps duplicate `orderIndex` writes to a conflict error.
- `#71`: ✅ Fixed (`P1`) — `SessionsService.updateSessionExercise()` now enforces optimistic version checks atomically at write time.
- `#72`: ✅ Fixed (`P2`) — `SessionsService.updateSessionExercise()` now maps duplicate `orderIndex` writes to a conflict error.
- `#73`: ✅ Fixed (`P1`) — `SessionsService.reorderSessionExercises()` now uses a two-phase reorder to avoid transient unique collisions during swaps.
- `#74`: ✅ Fixed (`P2`) — `SessionsService.createSet()` now maps duplicate `orderIndex` writes to a conflict error.
- `#75`: ✅ Fixed (`P2`) — `SessionsService.updateSet()` now maps duplicate `orderIndex` writes to a conflict error.
- `#76`: ✅ Fixed (`P1`) — `UsersService.updateMe()` now returns `USER_NOT_FOUND` when the user disappears during the write.
- `#77`: ✅ Fixed (`P2`) — `StreakService.incrementStreak()` now ignores out-of-order older completions instead of regressing streak state.
- `#78`: ✅ Fixed (`P3`) — `PrDetectionService.detectForSession()` now loads completed sets in deterministic `completedAt` order.

---

## Final Resolutions (29–38)

- Added PR recalculation after session soft-delete, with exercise-template dedupe.
- Updated session-exercise deletion flow to:
  - load owned target with active-session guard,
  - soft-delete safely,
  - refresh PRs,
  - refresh cached volume when parent session is finished.
- Updated swap flow to:
  - enforce active-session ownership,
  - capture old template id,
  - recalculate PRs for both template IDs (deduped).
- Added PR-affecting update gate for `updateSet` (`weight`, `reps`, `durationSeconds`, `isCompleted`, `completedAt`).
- Added preflight `count` validation for reorder IDs to prevent post-commit not-found errors.
- Added idempotent race handling for set creation:
  - detect relevant `P2002` unique violations,
  - refetch existing by `(sessionExerciseId, idempotencyKey)`,
  - return existing row when present.
- Reordered `finishSession` to compute side effects first, then persist final session status.
- Added `session.deletedAt: null` ownership guards for:
  - `updateSet`,
  - `deleteSet`,
  - `toggleSetCompletion`,
  - and related mutation paths touched in this pass.
- Updated checklist upsert select to include user timezone and pass it to `onChecklistCompleted`.
- Reworked batch set creation to use `Promise.all` and preserve result ordering.

## Final Resolutions (39–48)

- Added `session.deletedAt: null` guards to both completion count queries.
- Added `session.deletedAt: null` guard to session-volume aggregation.
- Added active-row guards to weekly progress aggregation:
  - `sessionExercise.deletedAt: null`
  - `session.deletedAt: null`
- Added the same active-row guards to exercise history pagination and total-count queries.
- Reworked active-session reads to pass session exercises through `SupersetService.interleave()` before returning.
- Added reorder preflight validation for workout templates so forbidden IDs fail before any `orderIndex` writes run.
- Updated user profile reads to query only active users and return `USER_NOT_FOUND` for deleted rows.
- Updated profile writes to check for an active user before issuing `update()`.
- Reworked account deletion into an interactive transaction that:
  - marks the active user deleted first,
  - aborts with `USER_NOT_FOUND` when no active row is updated,
  - and only then fans out template/session/token updates.
- Updated streak timezone resolution to return `null` for soft-deleted users so streak creation/update logic exits early.

## Final Resolutions (49–58)

- Filtered template-clone reads in `startSession()` to `exercise.deletedAt: null` so deleted exercises are not copied into new sessions.
- Reworked `startSession()` responses to pass created `sessionExercises` through `SupersetService.interleave()` before returning.
- Normalized session-list payloads so a deleted `workoutTemplate` relation is surfaced as `null` instead of leaking stale metadata.
- Added `sessionExercise.deletedAt: null` guards to set mutation ownership lookups for:
  - `updateSet()`
  - `deleteSet()`
  - `toggleSetCompletion()`
- Added nested `exercise.deletedAt: null` relation filters to workout-template list and detail reads.
- Kept `muscleCoverage` aligned with visible exercises by computing coverage only from non-deleted exercise rows.
- Normalized verified Google identity emails to lowercase before lookup and creation, keeping Google auth aligned with local-auth email canonicalization.
- Added a pre-upsert checklist read so re-saving a completed checklist item preserves its original `completedAt` timestamp instead of rewriting it.

## Final Resolutions (59–68)

- Added trimmed-lowercase email canonicalization to `AuthService.register()` before both availability checks and `user.create()`.
- Added the same trimmed-lowercase canonicalization to `AuthService.login()` before user lookup.
- Deduplicated exercise create payload relation arrays for:
  - `secondaryMuscleGroupIds`
  - `equipmentIds`
- Deduplicated exercise update payload relation arrays before `createMany()` for:
  - `secondaryMuscleGroupIds`
  - `equipmentIds`
- Updated exercise-history ordering to sort by `completedAt desc nulls last`, then `createdAt desc`, so incomplete/null-timestamp rows no longer shadow real history.
- Updated catalog list ordering for both muscle groups and equipment to use `sortOrder asc nulls last`, then `name asc`.
- Reworked ML client base-path normalization to strip all trailing slashes instead of only one.

## Final Resolutions (69–78)

- Reworked `SessionsService.updateSession()` to:
  - gate the write with `updateMany(... version: input.version ...)`,
  - re-read current state on a zero-row update,
  - and return `SESSION_VERSION_CONFLICT` instead of allowing stale overwrites.
- Reworked `SessionsService.updateSessionExercise()` with the same atomic version-write pattern and post-failure re-read to preserve conflict semantics under concurrent edits.
- Added duplicate-`orderIndex` conflict mapping for:
  - `addSessionExercise()`
  - `updateSessionExercise()`
  - `createSet()`
  - `updateSet()`
- Rebuilt session-exercise reorder writes as a two-phase transaction:
  - first move targeted rows to temporary negative indexes,
  - then apply the requested final indexes,
  - so valid swaps no longer trip the `(sessionId, orderIndex)` unique constraint mid-flight.
- Reworked `UsersService.updateMe()` to use an active-row `updateMany()` guard plus post-write reload, returning `USER_NOT_FOUND` if the row vanishes during the update.
- Updated streak increment logic to ignore older completion dates so late-arriving historical events do not rewind `lastCompletedDate` or reset active streaks.
- Added deterministic `completedAt asc` ordering to `PrDetectionService.detectForSession()` so equal-value candidate selection is stable across runs.

---

## Validation Snapshot

- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/checklist/checklist.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/services/completion.service.spec.ts src/services/volume.service.spec.ts src/services/streak.service.spec.ts src/modules/progress/progress.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/users/users.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/auth/auth.service.spec.ts src/modules/checklist/checklist.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/auth/auth.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/catalog/catalog.service.spec.ts src/modules/ml-client/ml-client.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/users/users.service.spec.ts src/services/streak.service.spec.ts src/services/pr-detection.service.spec.ts` ✅
- `pnpm --filter @irontrack/api typecheck` ✅
- `pnpm --filter @irontrack/api test:cov` ✅ (`100/100/100/100`)
