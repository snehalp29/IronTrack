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

---

## Current Status

- Total findings tracked: **26**
- Open findings: **3** (`#24`, `#25`, `#26`)
- Fixed findings: **23**
- Historical code snippets for fixed items were removed to keep this document compact.

---

## Findings Index

| #   | Severity | Finding (Short)                                                                         | Status   |
| --- | -------- | --------------------------------------------------------------------------------------- | -------- |
| 1   | P1       | `detectForSession` lacked transaction for sequential PR upserts                         | ✅ Fixed |
| 2   | P2       | `recalculateForExercise` missed `sessionId` provenance in upsert payloads               | ✅ Fixed |
| 3   | P2       | Stale PR rows not deleted when no valid candidates remained                             | ✅ Fixed |
| 4   | P2       | Workout streak date used wall clock instead of completion timestamp                     | ✅ Fixed |
| 5   | P2       | `cacheSessionVolume` could throw unhandled `P2025` on missing session                   | ✅ Fixed |
| 6   | P3       | O(n²) grouping due to repeated array spread in PR candidate accumulation                | ✅ Fixed |
| 7   | P3       | Null `completedAt` silently replaced with current timestamp in PR logic                 | ✅ Fixed |
| 8   | P3       | Superset interleave ordering was non-deterministic on equal order index                 | ✅ Fixed |
| 9   | P3       | Completion percent precision/rounding behavior not normalized                           | ✅ Fixed |
| 10  | P3       | Missing service test scenarios across completion/PR/streak/superset paths               | ✅ Fixed |
| 11  | P1       | `recalculateForExercise` writes/deletes not wrapped atomically                          | ✅ Fixed |
| 12  | P2       | Invalid timezone strings could throw uncaught `RangeError`                              | ✅ Fixed |
| 13  | P2       | Recalculate specs were incompatible with transactional implementation                   | ✅ Fixed |
| 14  | P3       | Checklist streak threshold logic used brittle `=== 4` check                             | ✅ Fixed |
| 15  | P2       | Streak create path had TOCTOU race on `findUnique` → `create`                           | ✅ Fixed |
| 16  | P3       | Candidate-skip test omitted `$transaction` mock/assertion hardening                     | ✅ Fixed |
| 17  | P1       | Cross-tenant template/exercise references accepted in write paths                       | ✅ Fixed |
| 18  | P2       | Finished-session volume cache drift after post-finish set mutations                     | ✅ Fixed |
| 19  | P3       | Workout-template reorder DTO allowed duplicate IDs/order indexes                        | ✅ Fixed |
| 20  | P3       | Streak unique-constraint helper was overly broad                                        | ✅ Fixed |
| 21  | P3       | Streak timezone resolution always queried user (avoidable DB round-trip)                | ✅ Fixed |
| 22  | P3       | Streak update branch vulnerable to lost update under concurrency                        | ✅ Fixed |
| 23  | P3       | PR detection duplicated Epley 1RM logic instead of central helper usage                 | ✅ Fixed |
| 24  | P2       | Set queries include soft-deleted `SessionExercise` records (`deletedAt` filter missing) | ⏳ Open  |
| 25  | P3       | `VolumeService.calculateSetVolume` wrapper shadows imported function                    | ⏳ Open  |
| 26  | P3       | Invalid timezone input fallback is silent (no warning/telemetry)                        | ⏳ Open  |

---

## Open Findings Detail

### #24 (P2) Missing `sessionExercise.deletedAt` filter in set queries

Affected:

- `apps/api/src/services/pr-detection.service.ts` (`detectForSession`, `recalculateForExercise`)
- `apps/api/src/services/volume.service.ts` (`calculateSessionVolume`)

Risk:

- Sets tied to soft-deleted `SessionExercise` rows can still be counted for volume and PRs.

Expected fix:

- Add `sessionExercise.deletedAt: null` to all relevant set queries.
- Add tests ensuring soft-deleted session-exercise sets are excluded.

### #25 (P3) Confusing `VolumeService.calculateSetVolume` wrapper indirection

Affected:

- `apps/api/src/services/volume.service.ts`

Risk:

- Readability/maintainability issue due to method-name shadowing of imported helper.

Expected fix:

- Remove wrapper method and use imported `calculateSetVolume` directly in reducers/call sites.

### #26 (P3) Silent invalid-timezone fallback

Affected:

- `apps/api/src/services/streak.service.ts` (`resolveTimezone`, `formatDateInTimezone`)

Risk:

- Bad timezone data is silently coerced to UTC without observability.

Expected fix:

- Validate timezone before use and log warning (with user context) on fallback.

---

## Verification Summary

| Pass | Date       | Coverage of Findings                        | Result                        |
| ---- | ---------- | ------------------------------------------- | ----------------------------- |
| 1    | 2026-03-05 | 1–10                                        | ✅ Fixed                      |
| 2    | 2026-03-05 | 11 (open at this pass) + discovery of 12–14 | ✅ 11 fixed in pass 3         |
| 3    | 2026-03-05 | 11–14                                       | ✅ Fixed                      |
| 4    | 2026-03-05 | 17–19                                       | ✅ Fixed                      |
| 5    | 2026-03-05 | 15–16                                       | ✅ Fixed                      |
| 6    | 2026-03-05 | 20–23                                       | ✅ Fixed                      |
| 7    | 2026-03-05 | Re-verify 20–23 and discover 24–26          | ✅ 20–23 verified; 24–26 open |

---

## Latest Validation Snapshot

- `pnpm --filter @irontrack/api test:cov` recorded passing at strict gate (`100/100/100/100`) in the latest verification cycle before findings `#24–#26` were documented.
