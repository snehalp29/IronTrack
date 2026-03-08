# Code Review — Domain Services

Scope: `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `0 open`

Fixed: `#1–#120` foundational correctness, deleted-row filtering, ordering, ownership guards, optimistic concurrency, and early coverage gaps; `#121–#206` session finish hardening, volume recache, transactional batch set creation, bounded payload/query windows, idempotency safety, ML client hardening, validation alignment, and Prisma/service safety fixes; `#208–#265` DB hardening, rollback/PR fixes, explicit module wiring, HTTP semantics, logger/catalog/timezone/volume hardening, finished-session-only history/progress, paginated template-list metadata, checklist future-date guards, and web contract fixes; `#266–#278` and `#280–#285` DELETE 204 semantics, exercise/checklist/progress/web invalidation fixes, ML error narrowing, version-aware workout-store migration, checklist upsert query reduction, dead client streak helper removal, and 204 delete-account client cleanup; `#286`, `#288`, `#290`, and `#291` distinct checklist-type streak gating, deterministic superset ordering, clearer completion rounding, and explicit session-volume ownership filtering.

Non-defects: `#159`, `#207`, `#279`, `#283`, `#287`, and `#289`.

Open: none.

---

Outcomes: reviewed service paths now enforce active-row ownership and soft-delete semantics much more consistently; session mutation flows are materially safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.

Validation: targeted API service/controller specs, Prisma schema guards, shared sync/math utilities, full API unit/e2e reruns, `pnpm --filter @irontrack/api typecheck`, `pnpm --filter @irontrack/shared typecheck`, `pnpm lint:code`, and `pnpm format:check`.
