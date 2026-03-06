# Code Review — Domain Services (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-06

## Scope

- `apps/api/src/services/*.service.ts` in reviewed domain-service scope
- `apps/api/src/modules/*/*.service.ts` in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client
- Related unit tests for the same services

## Status

- Total findings: **145**
- Open: **8**
- Fixed: **137**

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
- `#121–#133`: session route disambiguation, guarded finish-session claim/revert flow, finished-session volume recache on exercise adds, transactional batch set creation, soft-delete-safe idempotency lookups, bounded session/template payloads and query windows, refreshed swap responses, `PRRecord` cleanup on exercise soft delete, and mixed-source session start rejection.
- `#134, #138, #139, #142`: iterative nested set-payload validation, transactional default template ordering, refreshed template update responses, and safer finish-session rollback filters.

## Open Findings

- `#135` `P2` [checklist.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/checklist/checklist.service.ts): `upsert()` still derives `completedAt` from a standalone pre-read and can overwrite completion timestamps under concurrent writes.
- `#136` `P2` [auth.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/auth/dto/auth.schemas.ts): bcrypt-backed passwords still allow inputs beyond the 72-byte bcrypt truncation boundary.
- `#137` `P3` [env.schema.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/config/env.schema.ts): the production `CORS_ORIGINS` requirement is still enforced outside the Zod schema.
- `#140` `P3` [sessions.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/sessions/sessions.service.ts): session list date-range validation is still duplicated between the schema and the service.
- `#141` `P3` [auth.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/auth/dto/auth.schemas.ts): auth email fields still lack an RFC-style max length bound.
- `#143` `P3` [auth.schemas.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/auth/dto/auth.schemas.ts): `loginSchema` still accepts passwords longer than the effective bcrypt limit.
- `#144` `P4` [main.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/main.ts): `cookie-parser` is still registered globally even though no current auth path reads cookies.
- `#145` `P4` [progress.service.ts](/Users/sp_admin/Dev/Code/NestJS/IronTrack/apps/api/src/modules/progress/progress.service.ts): `weekly()` still re-counts muscle groups on every request instead of caching catalog size.

## Key Outcomes

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are safer around ordering conflicts, optimistic concurrency, rollback behavior, PR recomputation, and cached volume updates.
- Template create and update responses are more deterministic for clients, and set-payload parsing now fails safely on pathological nesting.
- Remaining risk is concentrated in checklist timestamp concurrency plus a few auth/config/perf items that sit adjacent to the service scope.

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
- `pnpm --filter @irontrack/api test -- src/modules/sessions/dto/session.schemas.spec.ts src/modules/workout-templates/dto/workout-template.schemas.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/exercises/exercises.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/sessions/dto/session.schemas.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/auth/google-token-verifier.service.spec.ts`
- `pnpm --filter @irontrack/api test -- src/modules/sessions/dto/session.schemas.spec.ts src/modules/sessions/sessions.service.spec.ts src/modules/workout-templates/workout-templates.service.spec.ts`
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/sessions.routing.e2e-spec.ts test/session-sets.validation.e2e-spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm lint:code`
- `pnpm format:check`
- `pnpm --filter @irontrack/api test:cov`
