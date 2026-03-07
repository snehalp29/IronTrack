# Code Review — Domain Services

Scope: `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `0 open`

Fixed:

- `#1–#120`: foundational correctness, deleted-row filtering, ordering, ownership guards, optimistic concurrency, and early coverage gaps.
- `#121–#206`: session finish hardening, volume recache, transactional batch set creation, bounded payload/query windows, idempotency safety, ML client hardening, validation alignment, and Prisma/service safety fixes.
- `#208–#265`: DB hardening, rollback/PR fixes, explicit module wiring, HTTP semantics, logger/catalog/timezone/volume hardening, finished-session-only history, paginated template-list metadata, checklist future-date guards, finished-session-only weekly progress, and web client contract fixes for user timezone/delete-account handling.
- `#159`, `#207`: verified non-defects / informational only.

Outcomes:

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are materially safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.
- The reviewed service backlog is closed; remaining risk is now untracked/unknown rather than in the documented queue.

Validation:

- Targeted API service/controller specs, Prisma schema guards, shared sync/math utilities, and full API unit/e2e reruns.
- `pnpm --filter @irontrack/api typecheck`, `pnpm --filter @irontrack/shared typecheck`, `pnpm lint:code`, and `pnpm format:check`.
