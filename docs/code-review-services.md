# Code Review — Domain Services

Branch: `phase_one`  
Date: `2026-03-06`

Scope: reviewed `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `35 open` — remaining findings listed below.

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
- `#188–#206`: Google JWKS upstream outage mapping and clock-skew tolerance, transactional inline-session accessibility checks, deleted-set idempotency conflict handling, bounded exercise relation arrays, corrected session finish/delete HTTP codes, progress week filtering by `completedAt`, completion ownership guards, future checklist-date rejection, update-set payload coupling, sync queue dropped-item reporting, dead refresh-duration guard removal, single-active-session protection with a partial DB index, progress cache TTL, template soft-delete idempotency, and DB-level length bounds for workout notes and template/exercise names.
- `#208, #209, #228–#230`: avatar URL protocol allowlisting, finish-session rollback volume reset, ghost-exercise DB checks, a `Set.completedAt` index, and serializable PR detection retries.
- Proactive follow-ups folded into the same pass: mirrored the exercise-accessibility transaction fix on template update, and covered legacy deleted-email rows during register retry.

Open Findings (pass 11 — auth excluded):

---

**#210 · P3 · `apps/api/src/modules/streak/streak.module.ts` / `apps/api/src/app.module.ts`**
`StreakModule` is not in `AppModule.imports`; it is reachable only transitively through `SessionsModule` and `ChecklistModule`. NestJS currently registers controllers from transitively imported modules, so `GET /streaks/workout` is accessible at runtime. However, if either of those two consumer modules removes its `StreakModule` import, the streak route silently disappears with no compile-time warning. The route should be owned explicitly by `AppModule`.
Fix: add `StreakModule` to `AppModule.imports` and add a corresponding assertion in `modules.metadata.spec.ts`.

---

**#211 · P3 · `apps/api/src/modules/sessions/sessions.service.ts` (finishSession rollback)**
When the rollback fires (see #209), any PR rows written by `prDetectionService.detectForSession` are not reverted. The PR detection service upserts `PersonalRecord` rows inside its own `$transaction`; that transaction commits before the outer catch block fires. A rolled-back finish therefore leaves orphaned or incorrectly elevated PR rows in the database.
Fix: move `detectForSession` inside the same try block but after the session status update, or wrap volume-cache + PR detection in a single DB transaction so they roll back atomically.

---

**#212 · P3 · `apps/api/src/main.ts`**
`app.enableCors({ origin: allowedOrigins, credentials: true })` does not set `exposedHeaders`. The `CorrelationIdInterceptor` injects `x-correlation-id` into every response, but browsers strip non-CORS-exposed headers from cross-origin responses. Browser clients and front-end error-tracking tools cannot read the correlation ID for debugging.
Fix: add `exposedHeaders: ['x-correlation-id']` to the `enableCors` options object.

---

**#213 · P3 · `apps/api/src/common/logger/winston-logger.service.ts` (log level)**
The Winston transport log level is set with `process.env.NODE_ENV === 'production' ? 'info' : 'debug'`. This reads the raw environment variable before NestJS `ConfigModule` validates and normalises it. If `NODE_ENV` is undefined or misspelled, production instances silently emit `debug`-level logs, leaking internal state.
Fix: inject `ConfigService` (or read from the validated env object) rather than `process.env` directly, or at minimum add a fallback: `(process.env.NODE_ENV ?? 'development') === 'production'`.

---

**#214 · P3 · `apps/api/src/common/logger/winston-logger.service.ts` (stack field)**
The `error()` method logs the stack trace under the key `trace`. Standard log aggregators (Datadog, Splunk, GCP Logging) index the stack under `stack` or `error.stack`. Storing it under `trace` means automated alerting and error grouping rules that key on `stack` will miss server errors.
Fix: rename the field to `stack` (or emit both `stack` and `error.stack` for compatibility).

---

**#215 · P3 · `apps/api/src/modules/sessions/sessions.service.ts` (durationSeconds cap)**
`durationSeconds` is computed as `Math.max(1, Math.round((finishedAt - startedAt) / 1000))` with no upper bound. A session started via a stale client or a future-dated `startedAt` can produce tens of thousands of seconds, corrupting aggregate stats. The value is stored to the DB and surfaced in progress/history endpoints.
Fix: cap at a reasonable maximum — e.g. `Math.min(86_400, Math.max(1, Math.round(...)))` (24 h) — and throw/warn if the raw value exceeds it.

---

**#216 · P3 · `apps/api/src/modules/workout-templates/workout-templates.controller.ts`**
`DELETE /:id` calls `softDelete` and returns the `{ success: true }` payload with HTTP 200. RESTful convention and the existing sessions precedent (fixed in #193) is 204 No Content for successful deletes. An inconsistent status code breaks generic client error-handling and API documentation contracts.
Fix: annotate the handler with `@HttpCode(HttpStatus.NO_CONTENT)` and return `void` / remove the response body.

---

**#217 · P3 · `apps/api/src/modules/users/users.controller.ts`**
`DELETE /users/me` returns HTTP 200 with `{ success: true }`. Same convention gap as #216.
Fix: `@HttpCode(HttpStatus.NO_CONTENT)`, return `void`.

---

**#218 · P3 · `apps/api/src/modules/catalog/catalog.service.ts`**
`muscleGroups()` and `equipment()` both issue `findMany` with no `take` limit. If the underlying tables grow (custom equipment types, imported muscle-group expansions), these become unbounded full-table scans returned to every unauthenticated caller. The Cache-Control header (#183) mitigates repeat load but not the initial response size.
Fix: add `take: 500` (or a configurable cap) to both queries as a defensive upper bound.

---

**#219 · P3 · `apps/api/src/modules/sessions/sessions.service.ts` (updateSession endedReason)**
`updateSession` accepts `endedReason` as a patchable field on `IN_PROGRESS` sessions. A client can pre-set `endedReason: 'AUTO_TIMEOUT'` before manually calling `finishSession`, making the finished session appear to have timed out rather than been user-completed. This corrupts downstream analytics distinguishing auto-vs-manual terminations.
Fix: strip `endedReason` from the `update` payload unless the session is being transitioned to a terminal status in the same request, or move `endedReason` to `finishSession` exclusively.

---

**#220 · P3 · `apps/api/src/modules/sessions/sessions.service.ts` (getSession relation depth)**
`getSession` and `getActiveSession` include all `sessionExercises → sets` relations with no `take` limit on either level. A session with hundreds of exercises each having hundreds of sets returns a multi-MB response in a single round-trip with no pagination signal to the client.
Fix: add `take` limits on the nested `include` for `sessionExercises` and `sets` (or move to a paginated sub-resource endpoint).

---

**#221 · P3 · `apps/api/src/services/pr-detection.service.ts`**
`detectForSession` collects up to `N_exercises × 4` individual `upsert` calls in memory and submits them as a single interactive `$transaction([...upserts])`. For a session with 50 exercises this is 200 upserts per transaction; at 200 exercises it is 800. PostgreSQL acquires row-level locks for each upsert; a large batch holds those locks for the full transaction duration, blocking concurrent sessions for the same user.
Fix: chunk the upserts into batches of ≤50 and execute sequentially, or replace the upsert array with a single `INSERT … ON CONFLICT DO UPDATE` via raw SQL / `createMany` + `updateMany` pair.

---

**#222 · P3 · `apps/api/src/modules/checklist/checklist.controller.ts`**
`PUT /checklist` is an upsert that creates a new checklist entry on first call. It always returns HTTP 200. RFC 7231 recommends 201 Created when a new resource is created; returning 200 makes it impossible for clients to distinguish creation from update without additional round-trips.
Fix: propagate an `isNew` flag from `ChecklistService.upsert` and return `HttpStatus.CREATED` on first creation.

---

**#223 · P3 · `apps/api/src/modules/sessions/sessions.service.ts` (assertSessionOwnership tx param)**
`assertSessionOwnership` reads from `this.prisma` directly and accepts no transaction client parameter. All other `assert*` helpers (`assertExerciseTemplatesAccessible`, `assertWorkoutTemplateOwnership`) accept a `tx` client so they can participate in the caller's transaction. `assertSessionOwnership` called inside a transaction body reads outside the transaction snapshot, creating a TOCTOU window.
Fix: add an optional `client: PrismaService | Prisma.TransactionClient = this.prisma` parameter and use it for the ownership query.

---

**#224 · P3 · `apps/api/src/modules/users/user.schemas.ts` (timezone validation placement)**
`timezone` is trimmed and length-checked in the Zod DTO but the IANA validity check (`Intl.supportedValuesOf` / `new Intl.DateTimeFormat`) is performed in `UsersService.update` which throws a plain `BadRequestException` with code `INVALID_TIMEZONE`. All other validation errors coming through the Zod pipe carry the unified `VALIDATION_ERROR` envelope (fixed in #184). The inconsistent error shape forces clients to handle two different 400 formats.
Fix: move the timezone IANA check into the Zod schema as a `.refine()` predicate so it is caught by `ZodValidationPipe` and wrapped in the standard envelope.

---

**#225 · P3 · `apps/api/src/modules/sessions/sessions.service.ts` (batchCreateSets duplicate idempotencyKey)**
Within a single `batchCreateSets` call, if two items in the same payload share the same `idempotencyKey`, the first item is created, the second hit the existing-row branch, and `synced` is returned for both — silently dropping one set. The duplicate is not flagged to the caller.
Fix: deduplicate or reject duplicate `idempotencyKey` values within the payload before processing, returning a 409 or 422 for the conflicting entry.

---

**#226 · P3 · `apps/api/src/modules/progress/progress.service.ts` (~L23)**
`endInclusive` is computed as `endExclusive - 1ms`, producing `T23:59:59.999Z`. This value is serialised into the API response as the week-end boundary. Clients that parse it as a date (e.g. `new Date(...).toISOString().slice(0, 10)`) receive the previous calendar day, creating an off-by-one in any UI that displays the week range. The query itself correctly uses `lt: endExclusive`, so the filtering is fine — only the response representation is misleading.
Fix: either remove `endInclusive` from the response body or recompute it as `new Date(endExclusive.getTime() - 86_400_000)` (subtract a full day) to return the last day of the week as a clean date.

---

**#227 · P3 · `apps/api/src/modules/exercises/exercises.service.ts` (history pagination)**
`history()` receives `page` and `pageSize` directly from the controller, which applies a Zod schema (`page ≥ 1`, `pageSize 1–100`). The service itself adds no internal clamp. If the schema is relaxed or bypassed (e.g., during a service-layer unit test or a future controller refactor that forgets the pipe), `pageSize` of 10 000 is passed straight to Prisma. This mirrors the pattern fixed for template listing (#187).
Fix: add `Math.min(pageSize, 200)` (or the agreed max) inside `history()` as a defensive service-layer bound, consistent with other paginated methods.

---

---

**#231 · P3 · `apps/api/prisma/schema.prisma` — `WorkoutTemplate.orderIndex` no per-user uniqueness**
`WorkoutTemplateExercise` has `@@unique([workoutTemplateId, orderIndex])` to prevent duplicate positions within a template, but `WorkoutTemplate` has only `@@index([userId])` — no `@@unique([userId, orderIndex])`. Two templates for the same user can share the same `orderIndex`, which produces an undefined ordering in the `list` query (`orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }]`). The application's `getNextOrderIndex` tries to prevent this, but race conditions between two simultaneous `create` calls can still produce duplicates (the serializable transaction retry only helps when `orderIndex` is not explicitly provided).
Fix: add `@@unique([userId, orderIndex])` or a partial unique index `WHERE "deletedAt" IS NULL` on `(userId, orderIndex)` to `WorkoutTemplate`.

---

**#232 · P3 · `apps/api/prisma/schema.prisma` — `PRRecord` has no audit timestamps**
`PRRecord` has `achievedAt` (the date the PR was set) but no `createdAt` or `updatedAt`. When `detectForSession` upserts an existing PR with a higher value, `achievedAt` is overwritten to the new achievement date. There is no field to record when the PR row was first created or when it was last upserted, making it impossible to audit PR history or detect erroneous overwrites in production logs.
Fix: add `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` to `PRRecord`, with a migration that backfills `createdAt = achievedAt` for existing rows.

---

**#233 · P3 · `apps/api/prisma/schema.prisma` — `Set.rpe` unbounded at DB level**
`rpe Float?` on `Set` has no `CHECK` constraint. RPE (Rate of Perceived Exertion) is a 1–10 scale; values outside this range are meaningless for analytics but are accepted by the database. Application-layer Zod validation exists in the DTO but there is no DB-level safety net for scripts, seed data, or future bypasses.
Fix: add `ALTER TABLE "Set" ADD CONSTRAINT "Set_rpe_range_check" CHECK ("rpe" IS NULL OR ("rpe" >= 0 AND "rpe" <= 10));` and assert it in `schema.prisma.spec.ts`.

---

**#234 · P3 · `apps/api/prisma/schema.prisma` — `UserStreak` has no `updatedAt`**
`UserStreak` tracks `currentStreakDays`, `longestStreakDays`, and `lastCompletedDate` but has no `updatedAt` column. When a streak is incorrectly incremented (e.g., due to a timezone bug or duplicate `onSessionFinished` call) there is no timestamp to correlate the bad write to a specific event or deployment.
Fix: add `updatedAt DateTime @updatedAt` to `UserStreak` and generate a migration.

---

**#235 · P3 · `apps/api/prisma/schema.prisma` — `ChecklistItem` has no `updatedAt`**
`ChecklistItem.isCompleted` and `completedAt` are mutable fields (toggled by the checklist service) but the model has no `updatedAt`. Toggled items cannot be correlated to a specific time or request in post-mortem investigation.
Fix: add `updatedAt DateTime @updatedAt` to `ChecklistItem`.

---

**#236 · P3 · `apps/api/prisma/schema.prisma` — `RefreshToken` missing index on `expiresAt`**
Token rotation and revocation queries that sweep expired tokens (e.g., a future cleanup job or any query using `WHERE "expiresAt" < NOW()`) have no index to leverage. The only existing index is on `userId` and `tokenHash`. As the `RefreshToken` table grows with revoked or expired tokens, expiry-based cleanup queries scan the full table.
Fix: add `@@index([expiresAt])` to `RefreshToken`.

---

**#237 · P3 · `apps/api/src/services/streak.service.ts` — silent optimistic lock miss, no retry**
`incrementStreak` uses `updateMany` with all current field values as an optimistic lock predicate (lines 134–149). When two concurrent `onSessionFinished` calls race (e.g., a manual finish and an auto-timeout processing in parallel), the second `updateMany` returns `count = 0` and the method silently returns without retrying. One of the two finishes loses its streak increment permanently; the streak count is left at N instead of N+1.
Fix: retry the full `findUnique → updateMany` cycle up to 3 times on `count === 0`, with a short random jitter between attempts.

---

**#238 · P3 · `apps/api/src/services/volume.service.ts` — non-transactional read-modify-write**
`cacheSessionVolume` calls `calculateSessionVolume` (a `findMany`) then `workoutSession.updateMany` as two independent operations (lines 33–45). A `toggleSetCompletion` that executes between the two writes produces a stale `totalVolume` cache: the count is correct for the pre-toggle snapshot but is written after the toggle has already committed. Because the cache value is also read by the finish rollback (#209), any concurrent toggle during a finish attempt compounds the stale-data window.
Fix: wrap both operations in a `$transaction` (or accept the stale-on-toggle behaviour and add a comment); at minimum document the race.

---

**#239 · P3 · `apps/api/prisma/schema.prisma` — `SessionExercise` missing index on `exerciseTemplateId`**
`PrDetectionService.recalculateForExercise` issues a `set.findMany` where the nested filter `sessionExercise.exerciseTemplateId = ?` must traverse the `SessionExercise` table. There is no `@@index([exerciseTemplateId])` on `SessionExercise` (only `@@index([sessionId])` and `@@unique([sessionId, orderIndex])`). For a user with hundreds of sessions per exercise this becomes a full `SessionExercise` table scan — exactly the hot path hit on every `deleteSessionExercise` call.
Fix: add `@@index([exerciseTemplateId])` to `SessionExercise`.

---

**#240 · P3 · `apps/api/prisma/schema.prisma` — `ExerciseVideo.url`, `User.avatarUrl`, `MuscleGroup.imageUrl/iconUrl` unbounded `@db.Text`**
These URL columns are declared `@db.Text` (PostgreSQL `TEXT`, unlimited length). They are not bounded in the schema. While application-layer Zod validation caps inputs, there is no DB-level enforcement. A direct migration insert or a Zod bypass leaves an unbounded string in the column, inflating row size and degrading index performance for tables that include these in projections.
Fix: add `@db.VarChar(2048)` (a standard URL max) to URL columns, with appropriate migrations.

---

**#241 · P3 · `apps/api/prisma/schema.prisma` — `WorkoutTemplate` names not unique per user at DB level**
There is no `@@unique([userId, name])` or expression index on `WorkoutTemplate`. The service normalizes names and normalizes case but does not check for existing names with the same value. A user can create two templates both named "Push Day". The application currently has no uniqueness guard; a race between two simultaneous `create` calls for the same name succeeds for both.
Fix: add a case-insensitive partial unique expression index `CREATE UNIQUE INDEX "WorkoutTemplate_userId_lower_name_active_key" ON "WorkoutTemplate"("userId", lower("name")) WHERE "deletedAt" IS NULL;` mirroring the existing pattern for `ExerciseTemplate` name uniqueness.

---

**#242 · P3 · `apps/api/prisma/schema.prisma` — `WorkoutSession.startedAt` accepts future timestamps**
`startedAt DateTime @default(now())` has no `CHECK ("startedAt" <= NOW() + INTERVAL '5 minutes')` constraint. A client can supply a future `startedAt` (or the field can be set by a faulty clock), making sessions appear in future date buckets in progress queries. This also inflates `durationSeconds` to a negative or arbitrarily large value when the session finishes before the fake `startedAt`.
Fix: add a DB `CHECK` constraint `"startedAt" <= (NOW() + INTERVAL '5 minutes')` (5-minute grace for clock skew); also enforce at the DTO layer.

---

**#243 · P3 · `apps/api/src/services/completion.service.ts` — two-count snapshot race**
`calculate` issues two `count` queries in a batch `$transaction([count, count])` (lines 10–38). Prisma's batch transaction uses PostgreSQL `READ COMMITTED` isolation by default. Under concurrent set toggling between the two counts, `totalSets` and `completedSets` can reflect different moments in time — e.g. `totalSets = 5, completedSets = 6` is impossible but `completedSets = 4` when the true value is 5 is possible. `isIncomplete` returned to the client would be incorrect.
Fix: add `isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead` to the batch transaction options.

---

**#244 · P3 · `apps/api/src/prisma/prisma.service.ts` — shutdown hook fires on `beforeExit`, not `SIGTERM`**
`enableShutdownHooks` registers `process.once('beforeExit', () => app.close())` (line 30). In containerized deployments (Kubernetes, Docker) the orchestrator sends `SIGTERM` to the process. `beforeExit` only fires when the Node.js event loop drains naturally — it is never emitted when the process receives an OS signal. Under `SIGTERM` the app is force-killed by the kernel timeout without flushing in-flight requests or closing the Prisma connection pool, risking data corruption or incomplete writes.
Fix: additionally register `process.once('SIGTERM', async () => { await app.close(); process.exit(0); })` and `process.once('SIGINT', ...)`.

---

**#245 · P3 · `apps/api/prisma/schema.prisma` — no CHECK enforcing `endedReason IS NOT NULL` when `status = 'FINISHED'`**
`WorkoutSession.endedReason EndedReason?` is nullable. The application always sets it on finish (`existing.endedReason ?? 'USER_ENDED'`, line 307 of sessions.service.ts), but the DB has no constraint `CHECK ("status" = 'IN_PROGRESS' OR "endedReason" IS NOT NULL)`. A direct SQL update, a migration error, or the rollback path (which restores `endedReason: existing.endedReason` — which could be NULL if the session was fresh) can leave a `FINISHED` session with `endedReason = NULL`, corrupting auto-vs-manual termination analytics.
Fix: add the `CHECK` constraint and assert it in `schema.prisma.spec.ts`; also ensure the rollback in `finishSession` defaults to `'USER_ENDED'` rather than restoring the potentially-NULL prior value.

---

**#246 · P3 · `apps/api/prisma/schema.prisma` — no `deletedAt` index on soft-deleted models**
`WorkoutSession`, `WorkoutTemplate`, `ExerciseTemplate`, `SessionExercise`, and `Set` all carry a `deletedAt DateTime?` column used as the primary soft-delete filter. None have a dedicated `@@index([deletedAt])`. Admin queries, cleanup jobs, or any future "show deleted records" endpoint that filters `WHERE deletedAt IS NOT NULL` scan the full table. Compound indexes on these tables (`(userId, deletedAt)`) would also improve the most common ownership + soft-delete filter used in every service query.
Fix: add `@@index([deletedAt])` to each soft-deleted model (or composite `@@index([userId, deletedAt])` where `userId` is present).

---

**#247 · P3 · `apps/api/prisma/schema.prisma` — `Set.weight` and `Set.reps` have no non-negative check constraints**
`weight Float?` and `reps Int?` on `Set` accept any value including negatives. Negative weight or rep counts are physically meaningless and would silently corrupt volume calculations (`weight * reps`), PR records, and 1RM estimates. The Zod DTO validates these at the API boundary, but there is no DB-level guard against out-of-band writes.
Fix: add `CHECK ("weight" IS NULL OR "weight" >= 0)` and `CHECK ("reps" IS NULL OR "reps" >= 0)` constraints to `Set`, and assert in `schema.prisma.spec.ts`.

---

Outcomes:

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are materially safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.
- The previously tracked service backlog is closed for the reviewed scope, including `#188–#206`. `#207` remains informational only and does not require action.

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
