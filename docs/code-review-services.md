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

---

## Current Status

- Total findings tracked: **48**
- Open findings: **0**
- Fixed findings: **48**
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

---

## Validation Snapshot

- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/checklist/checklist.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test -- src/services/completion.service.spec.ts src/services/volume.service.spec.ts src/services/streak.service.spec.ts src/modules/progress/progress.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/users/users.service.spec.ts` ✅
- `pnpm --filter @irontrack/api typecheck` ✅
- `pnpm --filter @irontrack/api test:cov` ✅ (`100/100/100/100`)
