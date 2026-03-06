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
- `apps/api/src/modules/auth/google-token-verifier.service.ts` + `.spec.ts`
- `apps/api/src/modules/catalog/catalog.service.ts` + `.spec.ts`
- `apps/api/src/modules/ml-client/ml-client.service.ts` + `.spec.ts`

---

## Current Status

- Total findings tracked: **132**
- Open findings: **12**
- Fixed findings: **120**
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
- `#79`: ✅ Fixed (`P1`) — `ExercisesService.create()` now trims exercise names before uniqueness checks and persistence.
- `#80`: ✅ Fixed (`P2`) — `ExercisesService.update()` now trims renamed exercise names before uniqueness checks and persistence.
- `#81`: ✅ Fixed (`P2`) — `ExercisesService.upsertNote()` now trims note content and rejects blank notes.
- `#82`: ✅ Fixed (`P2`) — `WorkoutTemplatesService.create()` now rejects duplicate exercise `orderIndex` values in the template payload.
- `#83`: ✅ Fixed (`P2`) — `WorkoutTemplatesService.update()` now rejects duplicate exercise `orderIndex` values in the template payload.
- `#84`: ✅ Fixed (`P2`) — `SessionsService.startSession()` now rejects duplicate inline exercise `orderIndex` values before writing.
- `#85`: ✅ Fixed (`P2`) — `SessionsService.startSession()` now maps nested duplicate `sessionExercises` order conflicts to an app-level conflict error.
- `#86`: ✅ Fixed (`P2`) — `GoogleTokenVerifierService` now refreshes JWKS when a cached keyset misses the requested `kid`.
- `#87`: ✅ Fixed (`P3`) — `GoogleTokenVerifierService` now rejects JWKS keys marked for non-signature use.
- `#88`: ✅ Fixed (`P3`) — `GoogleTokenVerifierService` now rejects JWKS keys that advertise a non-`RS256` algorithm.
- `#89`: ✅ Fixed (`P1`) — `ExercisesService.update()` now rejects edits to soft-deleted custom exercises.
- `#90`: ✅ Fixed (`P2`) — `ExercisesService.softDelete()` now matches only active custom exercises.
- `#91`: ✅ Fixed (`P1`) — `SessionsService.swapSessionExercise()` now guards the write with an active-row ownership predicate.
- `#92`: ✅ Fixed (`P1`) — `SessionsService.updateSet()` now guards the write with an active-row ownership predicate.
- `#93`: ✅ Fixed (`P1`) — `SessionsService.deleteSet()` now guards the write with an active-row ownership predicate.
- `#94`: ✅ Fixed (`P1`) — `SessionsService.toggleSetCompletion()` now guards the write with an active-row ownership predicate.
- `#95`: ✅ Fixed (`P2`) — `VolumeService.cacheSessionVolume()` now updates only active workout sessions.
- `#96`: ✅ Fixed (`P3`) — `PrDetectionService.recalculateForExercise()` now loads tie candidates in deterministic `completedAt/id` order.
- `#97`: ✅ Fixed (`P2`) — `UsersService.deleteMe()` now removes authored `ExerciseNote` and `ChecklistItem` rows.
- `#98`: ✅ Fixed (`P2`) — `UsersService.deleteMe()` now removes derived `PRRecord` and `UserStreak` rows.
- `#99`: ✅ Fixed (`P1`) — `ExercisesService.update()` now guards the transactional write with an active ownership predicate.
- `#100`: ✅ Fixed (`P1`) — `WorkoutTemplatesService.update()` now guards the transactional write with an active ownership predicate.
- `#101`: ✅ Fixed (`P1`) — `WorkoutTemplatesService.softDelete()` now guards the delete write with an active ownership predicate.
- `#102`: ✅ Fixed (`P1`) — `AuthService.refresh()` now rechecks that the user is still active after consuming the refresh token.
- `#103`: ✅ Fixed (`P1`) — `AuthService.googleLogin()` now guards Google-account upgrades against concurrent LOCAL or disabled-account transitions.
- `#104`: ✅ Fixed (`P2`) — `AuthService.register()` now validates timezone strings before persistence.
- `#105`: ✅ Fixed (`P2`) — `UsersService.updateMe()` now validates timezone strings before persistence.
- `#106`: ✅ Fixed (`P3`) — `ExercisesService.list()` now trims whitespace-padded `search` filters.
- `#107`: ✅ Fixed (`P3`) — `ExercisesService.list()` now trims whitespace-padded `muscleGroup` filters.
- `#108`: ✅ Fixed (`P3`) — `ExercisesService.list()` now trims whitespace-padded `equipment` filters.
- `#109`: ✅ Fixed (`P1`) — `SessionsService.finishSession()` now guards the final status write with an active-session predicate.
- `#110`: ✅ Fixed (`P1`) — `ExercisesService.update()` now guards the parent write before any relation-table rewrites run.
- `#111`: ✅ Fixed (`P1`) — `WorkoutTemplatesService.update()` now guards the parent write before any template-exercise rewrites run.
- `#112`: ✅ Fixed (`P2`) — `ExercisesService.create()` now rejects names that become too short after trimming.
- `#113`: ✅ Fixed (`P2`) — `ExercisesService.update()` now rejects renamed exercise names that become too short after trimming.
- `#114`: ✅ Fixed (`P2`) — `ExercisesService.create()` now maps concurrent name races back to `EXERCISE_NAME_EXISTS`.
- `#115`: ✅ Fixed (`P2`) — `ExercisesService.update()` now maps concurrent rename races back to `EXERCISE_NAME_EXISTS`.
- `#116`: ✅ Fixed (`P2`) — `WorkoutTemplatesService.create()` now trims template names and rejects names that become too short after trimming.
- `#117`: ✅ Fixed (`P2`) — `WorkoutTemplatesService.update()` now trims template names and rejects names that become too short after trimming.
- `#118`: ✅ Fixed (`P2`) — `SessionsService.startSession()` now rejects template starts when no active template exercises remain to clone.
- `#119`: ✅ Fixed (`P1`) — `SessionsService.reorderSessionExercises()` now keeps both reorder phases behind an active-session ownership predicate.
- `#120`: ✅ Fixed (`P2`) — `UsersService.deleteMe()` now deletes `SessionNote` rows alongside other user-owned data.
- `#121`: 🔴 Open (`P1`) — `sessions.controller.ts` route ordering: `@Patch(':sessionId/exercises/:id')` shadows `@Patch(':sessionId/exercises/reorder')` — reorder endpoint unreachable.
- `#122`: 🔴 Open (`P2`) — `finishSession` concurrent double side-effect fire: PRs, volume, streak mutated before FINISHED write; concurrent race fires them twice.
- `#123`: 🔴 Open (`P2`) — `addSessionExercise` missing volume re-cache for FINISHED sessions.
- `#124`: 🔴 Open (`P2`) — `batchCreateSets` partial commits: `Promise.all` without transaction; mid-batch failure leaves orphaned sets.
- `#125`: 🔴 Open (`P2`) — `createSetInternal` idempotency lookup skips `deletedAt: null`; soft-deleted set returned as duplicate hit.
- `#126`: 🔴 Open (`P2`) — `payload` field in set schema unconstrained: `z.record(z.string(), z.unknown())` allows arbitrary deep JSON.
- `#127`: 🔴 Open (`P3`) — `startSessionSchema` exercises array has no `.max()` — unbounded inline payload.
- `#128`: 🔴 Open (`P3`) — `batchCreateSetsSchema` sets array has no `.max()` — unbounded batch size.
- `#129`: 🔴 Open (`P3`) — `createWorkoutTemplateSchema` exercises array has no `.max()`.
- `#130`: 🔴 Open (`P3`) — `listSessionsQuerySchema` has no date-range cap; arbitrary `startDate`/`endDate` window loads unbounded rows.
- `#131`: 🔴 Open (`P3`) — `swapSessionExercise` returns thin pre-write snapshot `{ id, exerciseTemplateId }` instead of full updated record.
- `#132`: 🔴 Open (`P3`) — `ExercisesService.softDelete()` leaves orphan `PRRecord` rows for the deleted exercise template.

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

## Final Resolutions (79–88)

- Normalized custom exercise names with trimming before both uniqueness checks and persistence in:
  - `ExercisesService.create()`
  - `ExercisesService.update()`
- Normalized exercise notes with trimming and added a blank-note guard so whitespace-only note payloads fail fast with an app-level validation error.
- Added duplicate template-exercise `orderIndex` prevalidation for:
  - `WorkoutTemplatesService.create()`
  - `WorkoutTemplatesService.update()`
- Added duplicate session-exercise `orderIndex` prevalidation to `SessionsService.startSession()` for inline payloads before nested writes run.
- Wrapped `startSession()` nested create writes with duplicate-order conflict mapping so Prisma uniqueness errors now surface as `SESSION_EXERCISE_ORDER_CONFLICT`.
- Reworked Google JWKS key resolution to:
  - refresh once when a valid cached keyset misses the requested `kid`,
  - reject keys with `use` other than `sig`,
  - and reject keys with `alg` other than `RS256`.

## Final Resolutions (89–98)

- Added active-row guards to custom exercise edit/delete paths so soft-deleted exercises are no longer editable or re-deletable.
- Reworked stale-prone session mutations to use guarded `updateMany()` writes that require active ownership at write time for:
  - `swapSessionExercise()`
  - `updateSet()`
  - `deleteSet()`
  - `toggleSetCompletion()`
- Kept the session mutation return payloads stable by merging the applied scalar updates back onto the already-authorized row snapshots after guarded writes succeed.
- Scoped session-volume cache writes to `deletedAt: null` workout sessions so deleted sessions are no longer rewritten.
- Added deterministic `completedAt asc, id asc` ordering to PR recalculation candidate loads so tied achievements resolve consistently across runs.
- Expanded account deletion cleanup to delete non-soft-deletable user data in the same transaction:
  - `ExerciseNote`
  - `PRRecord`
  - `UserStreak`
  - `ChecklistItem`

## Final Resolutions (99–108)

- Reworked stale-prone custom exercise updates to use guarded transactional `updateMany()` writes plus a post-write reload, so deleted rows can no longer be edited after the ownership precheck.
- Reworked workout-template mutation writes to require active ownership at write time for:
  - `update()`
  - `softDelete()`
- Added active-user revalidation after refresh-token consumption so refresh rotation no longer issues fresh tokens for accounts deleted mid-request.
- Reworked Google account upgrade writes behind a guarded `updateMany()` path, with post-failure rechecks that preserve:
  - `USER_DISABLED`
  - `EMAIL_REGISTERED_WITH_PASSWORD`
- Added strict timezone validation to user-facing write flows in:
  - `AuthService.register()`
  - `UsersService.updateMe()`
- Normalized exercise list filters with trimming before query construction for:
  - `search`
  - `muscleGroup`
  - `equipment`

## Final Resolutions (109)

- Reworked `SessionsService.finishSession()` to apply the final `FINISHED` write through a guarded `updateMany()` path, then reload current session state so deleted or concurrently finished sessions no longer get blindly overwritten at the last step.

## Final Resolutions (110–118)

- Reordered stale-prone parent/child update flows so the guarded parent write happens before any child-row rewrite work in:
  - `ExercisesService.update()`
  - `WorkoutTemplatesService.update()`
- Added post-trim required-name validation to exercise create/update flows so names that collapse below the minimum length now fail fast with `EXERCISE_NAME_INVALID`.
- Added Prisma unique-constraint mapping for exercise create/update name races so concurrent collisions now surface as `EXERCISE_NAME_EXISTS`.
- Normalized workout-template names with trimming in both create and update flows, and added `TEMPLATE_NAME_INVALID` for names that collapse below the minimum length.
- Rejected template-backed session starts when the template no longer has any active exercises to clone, preventing empty sessions tied to stale template ids.

## Final Resolutions (119–120)

- Added `session.deletedAt: null` ownership guards to both phases of `reorderSessionExercises()` so deleted sessions can no longer have child `orderIndex` writes applied after the preflight checks.
- Expanded account deletion cleanup to remove `SessionNote` rows tied to the user’s sessions in the same transaction.

---

## Pass 13 — Verification (121–132 baseline) + New Findings

**Scope:** `sessions.controller.ts`, `sessions.service.ts` (full), `session.schemas.ts`, `exercises.controller.ts`, `exercises.service.ts`, `workout-templates.controller.ts`, `workout-template.schemas.ts`, `exercise.schemas.ts`, `progress.controller.ts`, `users.controller.ts`

### Verified Fixed (sample from #29–#120)

| #    | Location                                                                                | Verified |
| ---- | --------------------------------------------------------------------------------------- | -------- |
| #29  | `softDeleteSession` recalculates PRs (L439–458)                                         | ✅       |
| #30  | `deleteSessionExercise` recalculates PRs + recaches volume (L639–645)                   | ✅       |
| #31  | `swapSessionExercise` recalculates both template PRs (L779–789)                         | ✅       |
| #33  | `reorderSessionExercises` pre-validates count (L657–668)                                | ✅       |
| #34  | Idempotency `P2002` race refetch in `createSetInternal` (L1285–1305)                    | ✅       |
| #35  | Side-effects run before FINISHED write in `finishSession` (L270–295)                    | ✅       |
| #36  | Set mutations include `session.deletedAt: null`                                         | ✅       |
| #38  | `batchCreateSets` uses `Promise.all` (L1075–1079)                                       | ✅       |
| #73  | Two-phase reorder with temporary negative indexes (L671–717)                            | ✅       |
| #84  | `startSession` rejects duplicate `orderIndex` (assertUniqueSessionExerciseOrderIndexes) | ✅       |
| #85  | Nested order conflict mapping in `startSession`                                         | ✅       |
| #91  | `swapSessionExercise` guarded write (L759–773)                                          | ✅       |
| #92  | `updateSet` guarded write (L879–900)                                                    | ✅       |
| #93  | `deleteSet` guarded write (L949–963)                                                    | ✅       |
| #94  | `toggleSetCompletion` guarded write (L1025–1042)                                        | ✅       |
| #109 | `finishSession` guarded final write (L281–295)                                          | ✅       |
| #119 | Both reorder phases behind active-session predicate (L671–717)                          | ✅       |

### New Findings

---

#### #121 · P1 · `sessions.controller.ts` — `PATCH .../exercises/reorder` is unreachable

**File:** `apps/api/src/modules/sessions/sessions.controller.ts:94,119`

`@Patch(':sessionId/exercises/:id')` is registered at L94, before `@Patch(':sessionId/exercises/reorder')` at L119. NestJS/Express resolves routes in declaration order. Any `PATCH /sessions/X/exercises/reorder` request matches the `:id` handler with `id = "reorder"`, passing body validation against `updateSessionExerciseSchema` and routing to `updateSessionExercise`. The `reorderExercises` handler at L119 is permanently unreachable.

**Fix:** Move `@Patch(':sessionId/exercises/reorder')` to a position before `@Patch(':sessionId/exercises/:id')` in the controller file.

---

#### #122 · P2 · `sessions.service.ts` — Concurrent `finishSession` double-fires side-effects

**File:** `apps/api/src/modules/sessions/sessions.service.ts:260–316`

`finishSession` reads session status at L260, then runs `cacheSessionVolume`, `detectForSession`, `onSessionFinished`, and `completionService.calculate` (L270–280) before the `workoutSession.updateMany` commit at L281. Under concurrent requests:

1. Request A and B both read `IN_PROGRESS` and pass the status guard.
2. Both run all four side-effects — streak is incremented twice, PRs detected twice.
3. Request A's `updateMany` succeeds; request B finds `count = 0` and throws `SESSION_ALREADY_FINISHED`.

The duplicate streak fire is the most dangerous: `onSessionFinished` may increment `currentStreak` twice for the same session date.

**Fix:** Move the `cacheSessionVolume` and `detectForSession` calls to after the guarded `updateMany`; only run `onSessionFinished` and completion on success.

---

#### #123 · P2 · `sessions.service.ts` — `addSessionExercise` leaves volume cache stale on FINISHED sessions

**File:** `apps/api/src/modules/sessions/sessions.service.ts:463–491`

`addSessionExercise` calls `assertSessionOwnership` then creates the exercise row. It never checks `session.status` and never calls `volumeService.cacheSessionVolume()`. In contrast, `deleteSessionExercise` (L643–645) explicitly re-caches volume when `session.status === 'FINISHED'`. Adding an exercise to a finished session silently leaves the volume cache stale.

**Fix:** After the create, fetch `session.status` and call `cacheSessionVolume` when `FINISHED`.

---

#### #124 · P2 · `sessions.service.ts` — `batchCreateSets` has no transaction; partial failure leaves orphaned sets

**File:** `apps/api/src/modules/sessions/sessions.service.ts:1075–1079`

```typescript
const createdSets = await Promise.all(
  input.sets.map((set) =>
    this.createSetInternal(userId, sessionExerciseId, set, sessionExercise),
  ),
);
```

Each `createSetInternal` call issues its own `prisma.set.create`. If set N fails (e.g. duplicate `orderIndex`), sets 0..N-1 are already committed. No rollback occurs. The caller receives a `ConflictException` while the partial sets remain in the DB.

**Fix:** Wrap all `createSetInternal` calls in a `prisma.$transaction(async (tx) => ...)` and pass `tx` through.

---

#### #125 · P2 · `sessions.service.ts` — Idempotency pre-check includes soft-deleted sets

**File:** `apps/api/src/modules/sessions/sessions.service.ts:1232–1238`

```typescript
const existing = await this.prisma.set.findFirst({
  where: {
    sessionExerciseId,
    idempotencyKey: input.idempotencyKey,
  },
});
```

No `deletedAt: null` filter. A previously soft-deleted set matching `(sessionExerciseId, idempotencyKey)` is returned as a hit. The function short-circuits with `wasCreated: false` and returns the deleted row as if the create succeeded. The client never learns the set was deleted, and no new set is created.

The same pattern applies in the `catch` block recovery at L1290–1295.

**Fix:** Add `deletedAt: null` to both idempotency `findFirst` queries.

---

#### #126 · P2 · `session.schemas.ts` — `payload` field is unconstrained

**File:** `apps/api/src/modules/sessions/dto/session.schemas.ts:103`

```typescript
payload: z.record(z.string(), z.unknown()),
```

`z.unknown()` values can be deeply nested objects, arrays, or any JSON. There is no key-count limit, no depth limit, and no size limit. Clients can store multi-megabyte arbitrary JSON per set, causing unbounded DB row sizes and potential memory pressure during serialization.

**Fix:** Either constrain `payload` to a union of known set-type discriminated shapes, or add a `.refine()` that rejects payloads beyond a max serialized size (e.g. 4 KB).

---

#### #127 · P3 · `session.schemas.ts` — `startSessionSchema` exercises array unbounded

**File:** `apps/api/src/modules/sessions/dto/session.schemas.ts:14`

```typescript
exercises: z.array(...).default([])
```

No `.max()` constraint. A client can submit thousands of inline exercises in a single start-session call, triggering a massive nested `create` in `startSession` and a subsequent `assertUniqueSessionExerciseOrderIndexes` O(n) loop.

**Fix:** Add `.max(200)` (or a sensible cap).

---

#### #128 · P3 · `session.schemas.ts` — `batchCreateSetsSchema` sets array unbounded

**File:** `apps/api/src/modules/sessions/dto/session.schemas.ts:139`

```typescript
sets: z.array(createSetSchema).min(1);
```

No `.max()`. A batch of thousands of sets triggers an equivalent number of DB `create` calls via `Promise.all`.

**Fix:** Add `.max(100)` or similar.

---

#### #129 · P3 · `workout-template.schemas.ts` — exercises arrays unbounded

**File:** `apps/api/src/modules/workout-templates/dto/workout-template.schemas.ts:34,41`

`createWorkoutTemplateSchema` has `exercises: z.array(templateExerciseSchema).min(1)` and `updateWorkoutTemplateSchema` has `exercises: z.array(templateExerciseSchema).optional()`, both without `.max()`. Large exercise payloads can cause expensive delete-then-createMany operations in `update()`.

**Fix:** Add `.max(200)` to both arrays.

---

#### #130 · P3 · `session.schemas.ts` — No date-range cap on session list query

**File:** `apps/api/src/modules/sessions/dto/session.schemas.ts:36–37`

```typescript
startDate: z.string().datetime().optional(),
endDate: z.string().datetime().optional(),
```

No maximum range enforced. A client can request `startDate=2000-01-01` to `endDate=2030-12-31`, returning years of sessions in one paginated call. Combined with `pageSize` up to 100, this is low-cost on the caller side.

**Fix:** In `listSessions` service, enforce a maximum range (e.g. 366 days) or require pagination to be used within a bounded window.

---

#### #131 · P3 · `sessions.service.ts` — `swapSessionExercise` returns incomplete record

**File:** `apps/api/src/modules/sessions/sessions.service.ts:791–794`

```typescript
return {
  ...exercise, // { id, exerciseTemplateId } only — pre-write snapshot
  exerciseTemplateId: input.toExerciseTemplateId,
};
```

The fetched `exercise` object has only `id` and `exerciseTemplateId` (the `select` at L744–747). The return is a two-field object. In contrast, `updateSessionExercise` re-fetches and returns the full record. Clients calling swap get no `version`, `orderIndex`, `notes`, `supersetGroupKey`, or `updatedAt` — forcing an extra GET to stay in sync.

**Fix:** Add a post-write `findFirst` re-fetch (same pattern as `updateSessionExercise` L570–586) and return the full record.

---

#### #132 · P3 · `exercises.service.ts` — Soft-deleting an exercise leaves orphan `PRRecord` rows

**File:** `apps/api/src/modules/exercises/exercises.service.ts:274–293`

`softDelete` marks the `ExerciseTemplate` as deleted but does not delete or recalculate `PRRecord` rows that reference it. Those PRs remain live, reference an invisible exercise, and will surface in any progress or PR query that joins by `exerciseTemplateId`. Inconsistent with `deleteSessionExercise` which always calls `recalculateForExercise`.

Whether to delete or retain PRs is a product decision; at minimum the behavior should be intentional and documented.

**Fix:** Either call `prisma.pRRecord.deleteMany({ where: { userId, exerciseTemplateId } })` at deletion time, or call `recalculateForExercise` to ensure the PR state is consistent. If retention is intentional, add a comment.

---

## Validation Snapshot

- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/checklist/checklist.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/services/completion.service.spec.ts src/services/volume.service.spec.ts src/services/streak.service.spec.ts src/modules/progress/progress.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/users/users.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/auth/auth.service.spec.ts src/modules/checklist/checklist.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/auth/auth.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/catalog/catalog.service.spec.ts src/modules/ml-client/ml-client.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/users/users.service.spec.ts src/services/streak.service.spec.ts src/services/pr-detection.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/auth/google-token-verifier.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/users/users.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/services/volume.service.spec.ts src/services/pr-detection.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/auth/auth.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/users/users.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/sessions/sessions.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/users/users.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/users/users.service.spec.ts` ✅
- `pnpm --filter @irontrack/api typecheck` ✅
- `pnpm lint:code` ✅
- `pnpm format:check` ✅
- `pnpm --filter @irontrack/api test:cov` ✅ (`100/100/100/100`)
