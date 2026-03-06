# Code Review — Domain Services

Branch: `phase_one`  
Date: `2026-03-06`

Scope: reviewed `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `20 open` in the reviewed service scope.

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

Open Findings:

**#188 P2 — `apps/api/src/modules/auth/google-token-verifier.service.ts:212-216` — JWKS non-OK response throws `UnauthorizedException` instead of `BadGatewayException`**
When Google's JWKS endpoint returns a non-200 status (`!response.ok`), the code throws `UnauthorizedException({ code: 'INVALID_GOOGLE_TOKEN' })`. A Google infrastructure outage surfaces to the client as "your token is invalid" (401) rather than "upstream service is unavailable" (502). Mirrors the ML client fix in #169.
Fix: throw `new BadGatewayException({ code: 'GOOGLE_JWKS_UNAVAILABLE', message: 'Unable to fetch Google signing keys' })` when `!response.ok`.

**#189 P2 — `apps/api/src/modules/sessions/sessions.service.ts:59-64` — Inline-exercise accessibility check outside session create (TOCTOU)**
When starting a session with inline `exercises`, `assertExerciseTemplatesAccessible` at L60-63 runs before `prisma.workoutSession.create` at L98. Between the check and the insert, an exercise template could be soft-deleted, creating a session that references a now-deleted exercise. Mirrors the template TOCTOU fixed in #172.
Fix: move `assertExerciseTemplatesAccessible` inside the `workoutSession.create` call by wrapping the entire create in a transaction and checking exercise accessibility there.

**#190 P2 — `apps/api/src/modules/sessions/sessions.service.ts:1536-1556` — Soft-deleted set with `idempotencyKey` causes uncaught P2002 → 500**
`@@unique([sessionExerciseId, idempotencyKey])` in the schema holds even when the set is soft-deleted (no partial index on `deletedAt`). If a client: (1) creates a set with `idempotencyKey = K`; (2) deletes the set; (3) retries create with `idempotencyKey = K` — the DB fires P2002, the catch block queries `{ deletedAt: null }` (deleted set not found), falls through to `throw error`, and the raw Prisma error surfaces as an unhandled 500.
Fix: in the idempotency catch block, also query without the `deletedAt: null` filter; if the conflicting row has `deletedAt != null`, either soft-undelete it, create a new row with a compound key strategy, or return a structured 409.

**#191 P3 — `apps/api/src/modules/exercises/dto/exercise.schemas.ts:72-73` — No upper bound on `secondaryMuscleGroupIds` / `equipmentIds` arrays**
`secondaryMuscleGroupIds: z.array(z.string().uuid()).default([])` and `equipmentIds: z.array(z.string().uuid()).default([])` have no `.max()`. A payload with hundreds of UUIDs causes hundreds of `createMany` inserts in a single transaction. Same issue exists on `updateExerciseSchema`.
Fix: add `.max(20)` (or a reasonable constant) on both arrays in both schemas.

**#192 P3 — `apps/api/src/modules/sessions/sessions.controller.ts:67-69` — `POST :id/finish` returns 201 (resource-created) instead of 200**
NestJS defaults to 201 for `@Post`. `finishSession` is a state-transition action, not a resource creation — it should return 200.
Fix: add `@HttpCode(200)` to the `finish` handler.

**#193 P3 — `apps/api/src/modules/auth/google-token-verifier.service.ts:97` — No clock-skew tolerance in Google token expiry check**
`payload.exp * 1000 > Date.now()` rejects a token the instant it expires. If the API server's clock is even a few seconds ahead of Google's, a freshly-minted token (exp = now + 3600s as measured by Google) may be rejected. Standard practice (RFC 7519) allows a leeway window (typically 60s).
Fix: replace with `payload.exp * 1000 + CLOCK_SKEW_TOLERANCE_MS > Date.now()` where `CLOCK_SKEW_TOLERANCE_MS = 60_000`.

**#194 P3 — `apps/api/src/modules/progress/progress.service.ts:39` — `durationSeconds` selected but never used**
The `weekly()` query selects `durationSeconds` from `Set` at L39. After the `calculateSetVolume` fix (#181), that function ignores `durationSeconds` entirely (returns `weight * reps` or 0). The column is fetched across all sets in the week window for no purpose.
Fix: remove `durationSeconds` from the `select` block.

**#195 P3 — `apps/api/src/modules/progress/progress.service.ts:28-32` — Weekly volume window uses `session.startedAt`, not `set.completedAt`**
Sets are queried via `session.startedAt: { gte: start, lt: endExclusive }`. A set whose session started during the window but whose `completedAt` falls in the previous week (or vice versa — session started last week, set completed this week) is attributed to the wrong week. Since clients can supply `completedAt` directly (constrained only to non-future), the window could be meaningfully wrong for users who complete sets across midnight.
Fix: filter directly by `completedAt: { gte: start, lt: endExclusive }` with `completedAt: { not: null }` instead of scoping through session `startedAt`.

**#196 P3 — `apps/api/src/services/completion.service.ts:9` — `calculate(sessionId)` has no `userId` ownership guard**
`CompletionService.calculate` accepts only a `sessionId` and queries without verifying the caller owns the session. Currently called exclusively from `finishSession` (which already asserts ownership), but as a plain injectable service, any future caller can invoke it with an arbitrary `sessionId` and receive completion data for sessions they don't own.
Fix: add a `userId` parameter and include `session: { userId }` in the Prisma `where` clause.

**#197 P3 — `apps/api/src/modules/checklist/checklist.service.ts:17-25` — `getByDate` accepts future dates**
`getByDate` accepts any ISO date string passing `isoDateOnlySchema` — including dates 10 years in the future. The query returns an empty array (no items exist yet), but the endpoint is consistent with the rest-of-system pattern of rejecting future dates where they carry no meaning. Streak and set-completion paths already guard against future dates.
Fix: add a `date <= today` check in `getByDate`; throw `BadRequestException({ code: 'FUTURE_DATE_NOT_ALLOWED' })` for future dates.

**#198 P3 — `apps/api/src/modules/sessions/dto/session.schemas.ts:230-232` — `updateSetSchema` allows changing `weight`/`reps` without re-submitting `payload`**
`updateSetSchema = baseCreateSetSchema.partial()`. A client can PATCH `{ weight: 50 }` without re-submitting `payload`. The `type` and `payload` fields are optional, so after the update the stored `payload` may be inconsistent with the new `weight`/`reps` values (e.g. `payload` contains `{ reps: 10 }` but `reps` column is now 20).
Fix: in `updateSetSchema`, add a cross-field refinement: if `weight`, `reps`, or `durationSeconds` is supplied, require that `payload` also be supplied.

**#199 P3 — `libs/shared/src/utils/sync-queue.ts:151-154` — Exhausted items are silently dropped**
When `nextAttempts >= maxAttempts`, the item is deleted from the queue with `db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id])` and processing continues. No log line is emitted and the `SyncResult` return value has no field tracking dropped items. Silent data loss on persistent failures is hard to diagnose.
Fix: add a `dropped` counter to `SyncResult`, increment it on exhaustion, and emit a `console.error` or injected logger warning with the item's `entity_type`, `local_id`, and `operation`.

**#200 P3 — `apps/api/src/config/env.schema.ts` / `apps/api/src/modules/auth/auth.service.ts:356-363` — `parseDurationToMs` guard is dead code**
`parseDurationToMs` at L356-363 in `auth.service.ts` throws `new Error('Invalid JWT_REFRESH_EXPIRY value')` if `durationToSeconds` returns non-finite or ≤0. But `JWT_REFRESH_EXPIRY` is validated at startup by `envSchema` (which includes `durationSchema` and `refreshExpirySchema`). Any invalid value causes a startup crash before `parseDurationToMs` is ever called; the runtime guard can never trigger.
Fix: remove the dead defensive guard; rely on the startup validation.

**#201 P3 — `apps/api/src/modules/sessions/sessions.service.ts:483-521` — No DB constraint prevents two simultaneous IN_PROGRESS sessions per user**
`getActiveSession` returns `findFirst({ where: { userId, status: 'IN_PROGRESS' } })` ordered by `startedAt desc`. There is no unique constraint in the schema on `(userId, status)` filtered to IN_PROGRESS. A race between two `startSession` calls can create two active sessions; the second is permanently inaccessible via `getActiveSession`.
Fix: either add a partial unique index `CREATE UNIQUE INDEX … WHERE status = 'IN_PROGRESS'` on `WorkoutSession(userId)`, or enforce the constraint in `startSession` by checking for an existing IN_PROGRESS session before creating a new one and throwing a conflict.

**#202 P3 — `apps/api/src/modules/sessions/sessions.controller.ts:81-83` — `DELETE :id` returns 200 with body instead of 204 No Content**
`softDeleteSession` returns `{ success: true }` (200). REST convention for a successful DELETE is 204 No Content. The current shape makes delete responses inconsistent with standard client expectations.
Fix: add `@HttpCode(204)` and change the return type; clients parsing the body will need to be updated accordingly.

**#203 P3 — `apps/api/src/modules/progress/progress.service.ts:124-135` — `totalMuscleCountPromise` never invalidated on catalog changes**
The muscle group count is cached at the process level and never cleared unless a DB error occurs. Adding a new muscle group via seeder or admin tooling takes effect only after an API restart. For a fitness app where the catalog is stable, this is low risk, but it makes the coverage percentage silently stale.
Fix: add a `invalidateMuscleCount()` method called from any future catalog-write path, or switch to a short-lived TTL cache (e.g. 5 minutes) using `Date.now()`.

**#204 P3 — `apps/api/src/modules/workout-templates/workout-templates.service.ts:244-263` — `softDelete` double-delete returns wrong error code**
`softDelete` calls `assertOwnership` (which throws `TEMPLATE_FORBIDDEN` if not found) and then `updateMany({ where: { deletedAt: null } })`. If a concurrent request deletes the template between the ownership check and the `updateMany`, `updated.count` is 0 and a second `TEMPLATE_FORBIDDEN` is thrown — which is the wrong semantic (the caller successfully owns it, it's just already deleted). The delete should be idempotent for the owner.
Fix: wrap `assertOwnership` + `updateMany` in a single transaction, or treat `updated.count === 0` as success when the template exists but is already soft-deleted by the same user.

**#205 P3 — `apps/api/prisma/schema.prisma` — `WorkoutSession.notes` has no DB-level length constraint**
`notes String? @db.Text` is unbounded at the DB level. The DTO constrains it to `max(4000)` via Zod, but direct DB access or future code paths bypassing the DTO could insert arbitrarily large values.
Fix: add `@db.VarChar(4000)` to align the DB column type with the application-layer limit.

**#206 P3 — `apps/api/prisma/schema.prisma` — `ExerciseTemplate.name` and `WorkoutTemplate.name` have no DB-level length constraint**
Both `name String` fields map to PostgreSQL `TEXT`. Application schemas constrain to `max(120)`, but the DB column is unbounded. Consistent with the `User.email` fix in #176.
Fix: add `@db.VarChar(120)` to `ExerciseTemplate.name` and `WorkoutTemplate.name`.

**#207 P3 — `apps/api/src/modules/sessions/sessions.service.ts:54-64` — Template exercise accessibility re-checked after template ownership is already verified**
`startSession` with `workoutTemplateId` calls `assertWorkoutTemplateOwnership` at L55-58, then queries `workoutTemplateExercise` at L66-76 filtering `exercise.deletedAt: null`. If the template is owned, its exercises are always accessible (they're linked via FK). The accessibility check is implicit in the existing `exercise: { deletedAt: null }` filter on the query, but there is no separate `assertExerciseTemplatesAccessible` call for the template path. This is correct and clean — but the inconsistency with the inline-exercise path (which calls the explicit check) makes the code harder to audit. This finding is informational only; the template path is safe because it re-fetches exercises with `deletedAt: null`. Skip — not filing.

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
