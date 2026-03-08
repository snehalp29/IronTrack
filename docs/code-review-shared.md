# Code Review — Shared Library

Scope: `libs/shared/src/utils/`, `libs/shared/src/types/`, and `apps/api/src/testing/test-utils.ts`.

Status: `0 open`

Fixed: `#SH-2–#SH-5` sync queue malformed-payload dropping, exhausted-drop handling, and custom `maxAttempts` coverage; `#SH-3–#SH-4` UUID-backed default test emails plus broader user-graph cleanup; `#SH-7–#SH-10` timezone fallback, documented UTC `startOfWeek` contract, exported `MAX_ESTIMATE_ONE_RM_REPS`, and shared weight rounding; `#SH-12–#SH-14` non-UTC date formatting, `reps = 1` 1RM, and custom sync queue retry-limit coverage.

Non-defects: `#SH-1` volume remains intentionally load-only, `#SH-6` exported `DUE_SYNC_QUEUE_QUERY` is acceptable test-support surface, and `#SH-11` was already covered by the existing Sunday test.

Outcomes: shared library coverage remains `100%` across statements, branches, functions, and lines; sync replay failure handling is deterministic for malformed payloads and exhaustion edge cases; test helper defaults are safe under parallel execution.

Validation: `pnpm --filter @irontrack/shared test`, `pnpm --filter @irontrack/shared typecheck`, and `pnpm --filter @irontrack/api test -- --runTestsByPath src/testing/test-utils.spec.ts`.
