# Code Review — Domain Services

Scope: `apps/api/src/services/*.service.ts` and module services in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client, plus related unit/e2e coverage.

Status: `35 open`

Fixed History:

- `#1–#120`: foundational service correctness, side effects, soft-delete handling, deleted-row filtering, ordering fixes, ownership guards, optimistic concurrency, and early coverage gaps.
- `#121–#167`: session finish hardening, volume recache, transactional batch set creation, bounded payload/query windows, soft-delete-safe idempotency, refreshed responses, nested payload validation, template ordering, safer rollback filters, and finished-session mutation guards.
- `#168–#206`: ML client hardening, cookie-only refresh plumbing, sync queue hardening, validation envelope alignment, Prisma schema/index/check hardening, template pagination, progress/completion/checklist fixes, and session start/delete/finish safety.
- `#208–#209, #228–#230`: avatar URL protocol allowlisting, finish rollback volume reset, ghost-exercise DB checks, a `Set.completedAt` index, and serializable PR detection retries.
- `#159`, `#207`: verified non-defects / informational only.

**Open Queue**

- `#210` `P3` [streak.module.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/streak/streak.module.ts) / [app.module.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/app.module.ts): import `StreakModule` explicitly in `AppModule` so the route is not only transitively registered.
- `#211` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): finish rollback still does not revert committed PR writes atomically.
- `#212` `P3` [main.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/main.ts): expose `x-correlation-id` in CORS headers.
- `#213` `P3` [winston-logger.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/common/logger/winston-logger.service.ts): derive log level from validated env instead of raw `process.env.NODE_ENV`.
- `#214` `P3` [winston-logger.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/common/logger/winston-logger.service.ts): log stack traces under a standard `stack` field.
- `#215` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): cap `durationSeconds` to a sane maximum.
- `#216` `P3` [workout-templates.controller.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/workout-templates/workout-templates.controller.ts): `DELETE /:id` should return `204 No Content`.
- `#217` `P3` [users.controller.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/users/users.controller.ts): `DELETE /users/me` should return `204 No Content`.
- `#218` `P3` [catalog.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/catalog/catalog.service.ts): add a defensive `take` cap to unauthenticated catalog queries.
- `#219` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): stop allowing `endedReason` to be patched on in-progress sessions.
- `#220` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): bound or paginate deep `sessionExercises -> sets` reads.
- `#221` `P3` [pr-detection.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/services/pr-detection.service.ts): chunk large PR upsert batches to reduce long lock holds.
- `#222` `P3` [checklist.controller.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/checklist/checklist.controller.ts): return `201 Created` on first checklist upsert.
- `#223` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): let `assertSessionOwnership` accept a transaction client.
- `#224` `P3` [user.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/users/user.schemas.ts): move timezone validity into Zod for a consistent validation envelope.
- `#225` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): reject duplicate `idempotencyKey` values within one `batchCreateSets` payload.
- `#226` `P3` [progress.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/progress/progress.service.ts): return a clean week-end boundary instead of `endExclusive - 1ms`.
- `#227` `P3` [exercises.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/exercises/exercises.service.ts): clamp `history()` `pageSize` defensively in the service layer.
- `#231` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): enforce per-user uniqueness for `WorkoutTemplate.orderIndex`.
- `#232` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add `createdAt` / `updatedAt` to `PRRecord`.
- `#233` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add a DB range check for `Set.rpe`.
- `#234` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add `updatedAt` to `UserStreak`.
- `#235` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add `updatedAt` to `ChecklistItem`.
- `#236` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add an `expiresAt` index for `RefreshToken`.
- `#237` `P3` [streak.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/services/streak.service.ts): retry optimistic-lock misses instead of silently dropping streak updates.
- `#238` `P3` [volume.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/services/volume.service.ts): make `cacheSessionVolume` transactional or explicitly document stale-cache acceptance.
- `#239` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add `SessionExercise.exerciseTemplateId` index.
- `#240` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): bound URL-like `@db.Text` columns such as avatar and media URLs.
- `#241` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): enforce per-user active template-name uniqueness.
- `#242` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add future-`startedAt` safeguards for `WorkoutSession`.
- `#243` `P3` [completion.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/services/completion.service.ts): run the two completion counts at `RepeatableRead`.
- `#244` `P3` [prisma.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/prisma/prisma.service.ts): add `SIGTERM` / `SIGINT` shutdown hooks, not just `beforeExit`.
- `#245` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): require `endedReason` whenever a session is `FINISHED`.
- `#246` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add `deletedAt` indexes for soft-deleted models.
- `#247` `P3` [schema.prisma](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/prisma/schema.prisma): add non-negative DB checks for `Set.weight` and `Set.reps`.

Outcomes:

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are materially safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.
- The remaining service backlog is concentrated in `P3` infrastructure, controller semantics, and Prisma schema follow-ups.

Validation:

- Targeted API service/controller specs, Prisma schema guards, and shared sync/math utilities.
- `pnpm --filter @irontrack/api typecheck`
- `pnpm --filter @irontrack/shared typecheck`
- `pnpm lint:code`
- `pnpm format:check`
