# Code Review — Domain Services (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-05

## Scope

- `apps/api/src/services/*.service.ts` in reviewed domain-service scope
- `apps/api/src/modules/*/*.service.ts` in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client
- Related unit tests for the same services

## Status

- Total findings: **132**
- Open: **12**
- Fixed: **120**

## Fixed History

- `#1–#28`: foundational service correctness, side effects, soft-delete handling, and early coverage gaps.
- `#29–#38`: PR recalculation, volume/streak side effects, reorder validation, idempotency race handling, and finish-session sequencing.
- `#39–#48`: deleted-row filtering, active-user enforcement, guarded account deletion, and streak timezone safety.
- `#49–#58`: session/template soft-delete filtering, response normalization, set-ownership guards, Google email normalization, and checklist timestamp preservation.
- `#59–#68`: email/name normalization, relation dedupe, null-safe ordering, catalog ordering, and ML client path hardening.
- `#69–#78`: optimistic concurrency fixes, conflict mapping for duplicate ordering, and deterministic streak/PR behavior.
- `#79–#88`: exercise/template payload validation, duplicate-order guards, and Google JWKS cache/key hardening.
- `#89–#98`: soft-delete edit guards, active-row write predicates, finished-session cache guards, deterministic PR recalculation, and broader user cleanup.
- `#99–#109`: transactional ownership guards, refresh/google race tightening, timezone validation, trimmed query filters, and guarded session finishing.
- `#110–#120`: parent-write guards before relation rewrites, trimmed-name post-validation, create/update race mapping, empty-template start rejection, and `SessionNote` cleanup.

## Open Findings

- `#121` `P1` [sessions.controller.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.controller.ts): `@Patch(':sessionId/exercises/:id')` is ordered before `@Patch(':sessionId/exercises/reorder')`, so `reorder` can be swallowed as `id`.
- `#122` `P2` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): concurrent `finishSession()` calls can fire PR/volume/streak side effects twice before the final `FINISHED` write wins.
- `#123` `P2` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): `addSessionExercise()` does not recache volume when mutating an already finished session.
- `#124` `P2` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): `batchCreateSets()` uses `Promise.all` without a transaction, so mid-batch failure can leave partial commits.
- `#125` `P2` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): idempotency refetch in `createSetInternal()` can match a soft-deleted set because it does not filter `deletedAt: null`.
- `#126` `P2` [session.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/dto/session.schemas.ts): set `payload` is effectively unconstrained arbitrary JSON.
- `#127` `P3` [session.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/dto/session.schemas.ts): `startSessionSchema` has no cap on inline exercise count.
- `#128` `P3` [session.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/dto/session.schemas.ts): `batchCreateSetsSchema` has no cap on batch size.
- `#129` `P3` [workout-template.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/workout-templates/dto/workout-template.schemas.ts): template exercise arrays have no max bound.
- `#130` `P3` [session.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/dto/session.schemas.ts): session list queries have no enforced max date window.
- `#131` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): `swapSessionExercise()` returns a thin pre-write snapshot instead of the full updated row.
- `#132` `P3` [exercises.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/exercises/exercises.service.ts): soft-deleting an exercise leaves `PRRecord` rows behind without delete/recalc intent.

## Key Outcomes

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are safer around ordering conflicts, optimistic concurrency, PR recomputation, and cached volume updates.
- Input normalization and duplicate handling are much tighter across auth, exercises, templates, notes, and catalog lookups.
- Remaining risk is concentrated in route ordering, batch/transaction boundaries, and a few unbounded schema shapes.

## Validation

- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/checklist/checklist.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/services/completion.service.spec.ts src/services/volume.service.spec.ts src/services/streak.service.spec.ts src/modules/progress/progress.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/users/users.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/auth/auth.service.spec.ts src/modules/checklist/checklist.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/auth/auth.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/catalog/catalog.service.spec.ts src/modules/ml-client/ml-client.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/users/users.service.spec.ts src/services/streak.service.spec.ts src/services/pr-detection.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/auth/google-token-verifier.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/users/users.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/services/volume.service.spec.ts src/services/pr-detection.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/auth/auth.service.spec.ts src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/users/users.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/sessions/sessions.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/sessions/sessions.service.spec.ts src/modules/users/users.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/exercises/exercises.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/users/users.service.spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm lint:code`
- `pnpm format:check`
- `pnpm --filter @irontrack/api test:cov`
