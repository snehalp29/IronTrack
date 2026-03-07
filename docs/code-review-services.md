# Code Review — Domain Services

Scope: `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `0 open`

Fixed History:

- `#1–#120`: foundational service correctness, side effects, soft-delete handling, deleted-row filtering, ordering fixes, ownership guards, optimistic concurrency, and early coverage gaps.
- `#121–#167`: session finish hardening, volume recache, transactional batch set creation, bounded payload/query windows, soft-delete-safe idempotency, refreshed responses, nested payload validation, template ordering, safer rollback filters, and finished-session mutation guards.
- `#168–#206`: ML client hardening, cookie-only refresh plumbing, sync queue hardening, validation envelope alignment, Prisma schema/index/check hardening, template pagination, progress/completion/checklist fixes, and session start/delete/finish safety.
- `#208–#209, #228–#230`: avatar URL protocol allowlisting, finish rollback volume reset, ghost-exercise DB checks, a `Set.completedAt` index, and serializable PR detection retries.
- `#210–#212, #215–#217, #219–#222, #225–#227, #231–#237, #239–#259`: explicit `StreakModule` registration, finish rollback PR compensation, CORS correlation-id exposure, delete/upsert HTTP semantics, session/set bounds, repeatable-read completion counts, Prisma shutdown hooks, and consolidated Prisma schema/index/check hardening.
- `#213–#214, #218, #223–#224, #238`: schema-backed logger env normalization, standard stack logging, catalog query caps, transaction-aware session ownership checks, schema-level timezone validation, and transactional session-volume caching.
- `#159`, `#207`: verified non-defects / informational only.

**Open Queue**

- None in the reviewed service scope.

Outcomes:

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are materially safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.
- The reviewed service backlog is closed; remaining risk is now untracked/unknown rather than in the documented queue.

Validation:

- Targeted API service/controller specs, Prisma schema guards, and shared sync/math utilities.
- `pnpm --filter @irontrack/api typecheck`
- `pnpm --filter @irontrack/shared typecheck`
- `pnpm lint:code`
- `pnpm format:check`
