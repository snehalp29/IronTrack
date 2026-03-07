# Code Review — Shared Library

Scope: `libs/shared/src/utils/`, `libs/shared/src/types/`, and `apps/api/src/testing/test-utils.ts`.

Status: `0 open`

Fixed:

- `#SH-2–#SH-5`: sync queue now drops malformed payloads immediately, treats exhausted drops as terminal outcomes instead of double-counting them as conflicts, and has coverage for custom `maxAttempts`.
- `#SH-3–#SH-4`: test helpers now use UUID-backed default emails and clean up the full user-scoped graph needed by current Prisma relations.
- `#SH-7–#SH-10`: date formatting now falls back safely on invalid timezones, `startOfWeek` documents its UTC input contract, `MAX_ESTIMATE_ONE_RM_REPS` is exported, and weight formatting shares one rounding path.
- `#SH-12–#SH-14`: added boundary coverage for non-UTC date formatting, 1RM at `reps = 1`, and custom sync queue retry limits.

Closed as non-defects:

- `#SH-1`: volume is intentionally load-only; duration-only sets count for completion/coverage, not tonnage.
- `#SH-6`: exporting `DUE_SYNC_QUEUE_QUERY` is an acceptable test-support surface in this package.
- `#SH-11`: the Sunday branch in `startOfWeek()` was already covered by the existing `2026-03-01` test case.

Outcomes:

- Shared library coverage remains `100%` statements, branches, functions, and lines.
- Sync replay failure handling is now deterministic for malformed payloads and exhaustion edge cases.
- Test helper defaults are safe under parallel execution.

Validation:

- `pnpm --filter @irontrack/shared test`
- `pnpm --filter @irontrack/shared typecheck`
- `pnpm --filter @irontrack/api test -- --runTestsByPath src/testing/test-utils.spec.ts`
