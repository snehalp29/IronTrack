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

---

## Current Status

- Total findings tracked: **38**
- Open findings: **0**
- Fixed findings: **38**
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

---

## Validation Snapshot

- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/checklist/checklist.service.spec.ts` ✅
- `pnpm --filter @irontrack/api typecheck` ✅
- `pnpm --filter @irontrack/api test:cov` ✅ (`100/100/100/100`)
