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

- Total findings tracked: **28**
- Open findings: **0**
- Fixed findings: **28**
- Historical code snippets for fixed items were removed to keep this document compact.

---

## Findings Index

| #   | Severity | Finding (Short)                                                                                                  | Status   |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | P1       | `detectForSession` lacked transaction for sequential PR upserts                                                  | ✅ Fixed |
| 2   | P2       | `recalculateForExercise` missed `sessionId` provenance in upsert payloads                                        | ✅ Fixed |
| 3   | P2       | Stale PR rows not deleted when no valid candidates remained                                                      | ✅ Fixed |
| 4   | P2       | Workout streak date used wall clock instead of completion timestamp                                              | ✅ Fixed |
| 5   | P2       | `cacheSessionVolume` could throw unhandled `P2025` on missing session                                            | ✅ Fixed |
| 6   | P3       | O(n²) grouping due to repeated array spread in PR candidate accumulation                                         | ✅ Fixed |
| 7   | P3       | Null `completedAt` silently replaced with current timestamp in PR logic                                          | ✅ Fixed |
| 8   | P3       | Superset interleave ordering was non-deterministic on equal order index                                          | ✅ Fixed |
| 9   | P3       | Completion percent precision/rounding behavior not normalized                                                    | ✅ Fixed |
| 10  | P3       | Missing service test scenarios across completion/PR/streak/superset paths                                        | ✅ Fixed |
| 11  | P1       | `recalculateForExercise` writes/deletes not wrapped atomically                                                   | ✅ Fixed |
| 12  | P2       | Invalid timezone strings could throw uncaught `RangeError`                                                       | ✅ Fixed |
| 13  | P2       | Recalculate specs were incompatible with transactional implementation                                            | ✅ Fixed |
| 14  | P3       | Checklist streak threshold logic used brittle `=== 4` check                                                      | ✅ Fixed |
| 15  | P2       | Streak create path had TOCTOU race on `findUnique` → `create`                                                    | ✅ Fixed |
| 16  | P3       | Candidate-skip test omitted `$transaction` mock/assertion hardening                                              | ✅ Fixed |
| 17  | P1       | Cross-tenant template/exercise references accepted in write paths                                                | ✅ Fixed |
| 18  | P2       | Finished-session volume cache drift after post-finish set mutations                                              | ✅ Fixed |
| 19  | P3       | Workout-template reorder DTO allowed duplicate IDs/order indexes                                                 | ✅ Fixed |
| 20  | P3       | Streak unique-constraint helper was overly broad                                                                 | ✅ Fixed |
| 21  | P3       | Streak timezone resolution always queried user (avoidable DB round-trip)                                         | ✅ Fixed |
| 22  | P3       | Streak update branch vulnerable to lost update under concurrency                                                 | ✅ Fixed |
| 23  | P3       | PR detection duplicated Epley 1RM logic instead of central helper usage                                          | ✅ Fixed |
| 24  | P2       | Set queries included soft-deleted `SessionExercise` records (`deletedAt` filter missing)                         | ✅ Fixed |
| 25  | P3       | `VolumeService.calculateSetVolume` wrapper shadowed imported function                                            | ✅ Fixed |
| 26  | P3       | Invalid timezone fallback was silent (no warning/telemetry)                                                      | ✅ Fixed |
| 27  | P2       | `CompletionService.calculate` missed `sessionExercise.deletedAt: null` in count queries                          | ✅ Fixed |
| 28  | P2       | PR detection set queries missing `session.deletedAt: null` could include soft-deleted workouts in PR calculation | ✅ Fixed |

---

## Final Resolutions (24–28)

- `#24`: Added `sessionExercise.deletedAt: null` filters in `PrDetectionService.detectForSession`, `PrDetectionService.recalculateForExercise`, and `VolumeService.calculateSessionVolume`; added query-filter tests.
- `#25`: Removed `VolumeService.calculateSetVolume` wrapper; service now calls shared `calculateSetVolume` directly; test asserts wrapper is absent from prototype.
- `#26`: Added timezone validation in `StreakService.resolveTimezone` and `Logger.warn` fallback telemetry for invalid caller/DB timezones.
- `#27`: Added `sessionExercise.deletedAt: null` to both `CompletionService.calculate` count queries; added test asserting both count filters.
- `#28`: Added `session.deletedAt: null` in both `PrDetectionService.detectForSession` and `PrDetectionService.recalculateForExercise`; added/updated tests asserting both query filter shapes.

---

## Verification Summary

| Pass | Date       | Coverage of Findings            | Result                 |
| ---- | ---------- | ------------------------------- | ---------------------- |
| 1    | 2026-03-05 | 1–10                            | ✅ Fixed               |
| 2    | 2026-03-05 | 11 (+ discovery 12–14)          | ✅ Completed in pass 3 |
| 3    | 2026-03-05 | 11–14                           | ✅ Fixed               |
| 4    | 2026-03-05 | 17–19                           | ✅ Fixed               |
| 5    | 2026-03-05 | 15–16                           | ✅ Fixed               |
| 6    | 2026-03-05 | 20–23                           | ✅ Fixed               |
| 7    | 2026-03-05 | Re-verify 20–23; discover 24–26 | ✅ Completed in pass 8 |
| 8    | 2026-03-05 | 24–26                           | ✅ Fixed               |
| 9    | 2026-03-05 | 27                              | ✅ Fixed               |
| 10   | 2026-03-05 | Verify 27; discover 28          | ✅ 27 verified         |
| 11   | 2026-03-05 | 28                              | ✅ Fixed               |

---

## Verification Pass 11 — 2026-03-05

Verified against current `pr-detection.service.ts` + `.spec.ts`.

| #   | Finding                                                                                                   | Status   | Notes                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | PR detection set queries missing `session.deletedAt: null` could include soft-deleted workouts in results | ✅ Fixed | Both `detectForSession` and `recalculateForExercise` now filter `session: { userId, deletedAt: null }`; spec asserts both query filter payloads include this guard. |

---

## Latest Validation Snapshot

- `pnpm --filter @irontrack/api typecheck` ✅
- `pnpm --filter @irontrack/api test:cov` ✅ (`100/100/100/100`)
