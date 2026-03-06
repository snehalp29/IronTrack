# Code Review — Domain Services

Branch: `phase_one`  
Date: `2026-03-06`

Scope: reviewed `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `0 open` in the reviewed service scope.

Fixed:

- `#1–#28`: foundational service correctness, side effects, soft-delete handling, early coverage gaps.
- `#29–#58`: PR/volume/streak side effects, reorder validation, deleted-row filtering, active-user/account deletion guards, session/template filtering, response normalization.
- `#59–#88`: email/name normalization, relation dedupe, ordering fixes, ML client hardening, optimistic concurrency, duplicate-order conflict mapping, payload validation, JWKS cache/key hardening.
- `#89–#120`: soft-delete edit guards, active-row write predicates, cache guards, PR recalculation cleanup, ownership/race tightening, timezone/query normalization, session finish hardening, relation rewrite guards.
- `#121–#142`: session route disambiguation, finish-session claim/revert flow, volume recache, transactional batch set creation, bounded payload/query windows, soft-delete-safe idempotency, refreshed swap/template responses, nested payload validation, default template ordering, safer rollback filters.
- `#135, #136, #143, #144`: checklist `completedAt` preservation, password `max(128)` bounds, and the now-required `cookie-parser` auth plumbing.
- `#137, #140, #141, #145–#158, #160, #161`: Zod-native production CORS validation, duplicate service-side date-range removal, auth email max bounds, cached muscle-group totals, safer session optimistic locking, finished-session mutation guards, transactional PR recalculation on session delete, refetched set responses, bounded session-exercise notes, trimmed exercise filters/search, template duplicate-order validation, future `completedAt` rejection, serialized delete-time PR recalculation, and redundant superset dedupe removal.
- `#162–#167`: additional finished-session mutation holes closed for `deleteSessionExercise`, `createSet`, `updateSet`, `deleteSet`, `toggleSetCompletion`, and `batchCreateSets`.
- `#159`: verified not a defect. JWT auth already rejects deleted accounts through active-user validation in [auth.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/auth/auth.service.ts) and [jwt.strategy.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/auth/strategies/jwt.strategy.ts).

Outcomes:

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are materially safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.
- The previously tracked service backlog is closed for the reviewed scope.

Validation:

- Targeted service suites across sessions, checklist, exercises, workout-templates, users, progress, volume, streak, PR detection, auth, catalog, ml-client, and session/template DTOs.
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/sessions.routing.e2e-spec.ts test/session-sets.validation.e2e-spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm lint:code`
- `pnpm format:check`
- `pnpm --filter @irontrack/api test:cov`
