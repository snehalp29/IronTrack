# Code Review — Domain Services

Branch: `phase_one`  
Date: `2026-03-06`

Scope: reviewed `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `20 open` — pass 11 findings below (auth module excluded per scope decision).

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
- Proactive follow-ups folded into the same pass: mirrored the exercise-accessibility transaction fix on template update, and covered legacy deleted-email rows during register retry.

Open Findings (pass 11 — auth excluded):

---

**#208 · P2 · `apps/api/src/modules/users/user.schemas.ts`**
`avatarUrl` validated with `z.string().url()`. Node's `URL` constructor (which Zod uses internally) accepts `javascript:alert(1)` and `data:text/html,…` as valid URLs. If the client renders the avatar URL in an `<img src>`, `<a href>`, or React `dangerouslySetInnerHTML`, this is a stored XSS vector.
Fix: add a protocol allowlist — `.refine(v => /^https?:\/\//i.test(v), { message: 'avatarUrl must use http or https' })` — inside the `optionalTrimmed` wrapper.

---

**#209 · P2 · `apps/api/src/modules/sessions/sessions.service.ts` (finishSession rollback, ~L350–364)**
The catch-path rollback resets `status`, `finishedAt`, `endedReason`, and `durationSeconds`, but omits `totalVolume: null`. If `cacheSessionVolume` succeeds and `prDetectionService.detectForSession` subsequently throws, the session reverts to `IN_PROGRESS` while carrying a non-null `totalVolume`. Any later legitimate finish will re-cache the correct value, but during the window the session exposes an incorrect volume figure and any client caching it will show stale data.
Fix: add `totalVolume: null` to the rollback `data` object at line ~362.

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
