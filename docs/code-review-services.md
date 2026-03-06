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
- `#168–#187`: ML client request timeouts and upstream error mapping, cookie-only refresh tokens, deleted-email slot recovery and delete-time identity tombstoning, transactional template accessibility checks, sync queue max-attempt/jitter hardening, cached auth cookie config, query-string-safe exception logging, Prisma column/index/check-constraint hardening, guarded empty-template updates, exercise-history accessibility filtering, duration-free volume math, capped 1RM estimation, catalog cache headers, unified class-validator/Zod 400 envelopes, and paginated template listing.
- Proactive follow-ups folded into the same pass: mirrored the exercise-accessibility transaction fix on template update, and covered legacy deleted-email rows during register retry.

Outcomes:

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are materially safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.
- The previously tracked service backlog is closed for the reviewed scope, including the reopened `#168–#187` batch.

Validation:

- Targeted service suites across auth, ml-client, workout-templates, exercises, users, catalog, common validation/filter helpers, Prisma schema guards, and shared sync/math utilities.
- `pnpm --filter @irontrack/api test -- --runTestsByPath src/modules/auth/dto/auth.schemas.spec.ts src/modules/auth/auth.controller.spec.ts src/modules/auth/auth.service.spec.ts src/modules/ml-client/ml-client.service.spec.ts src/modules/workout-templates/dto/workout-template.schemas.spec.ts src/modules/workout-templates/workout-templates.controller.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/users/users.service.spec.ts src/modules/catalog/catalog.controller.spec.ts src/common/filters/http-exception.filter.spec.ts src/common/utils/one-rm.spec.ts src/common/pipes/app-validation.pipe.spec.ts src/services/volume.service.spec.ts src/prisma/schema.prisma.spec.ts`
- `pnpm --filter @irontrack/api test -- --runTestsByPath src/main.spec.ts`
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/auth.e2e-spec.ts`
- `pnpm --filter @irontrack/shared test -- --runInBand libs/shared/src/__tests__/utils.spec.ts libs/shared/src/__tests__/sync-engine-core.spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm --filter @irontrack/shared typecheck`
- `pnpm lint:code`
- `pnpm format:check`
