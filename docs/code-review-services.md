# Code Review — Domain Services (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-06

## Scope

- `apps/api/src/services/*.service.ts` in reviewed domain-service scope
- `apps/api/src/modules/*/*.service.ts` in sessions, checklist, exercises, progress, users, workout-templates, auth, catalog, and ml-client
- Related unit tests for the same services

## Status

- Total findings: **133**
- Open: **0**
- Fixed: **133**

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
- `#121–#132`: session route disambiguation, guarded finish-session claim/revert flow, finished-session volume recache on exercise adds, transactional batch set creation, soft-delete-safe idempotency lookups, bounded session/template payloads and query windows, refreshed swap responses, and `PRRecord` cleanup on exercise soft delete.
- `#133`: session starts now reject mixed template-plus-inline payloads instead of silently discarding inline exercises.

## Key Outcomes

- Most reviewed service paths now enforce active-row ownership and soft-delete semantics consistently.
- Session mutation flows are safer around ordering conflicts, optimistic concurrency, PR recomputation, and cached volume updates.
- Input normalization and duplicate handling are much tighter across auth, exercises, templates, notes, and catalog lookups.
- Follow-up review closed mixed-source session starts; no additional concrete `P0–P4` defects remain open in the reviewed service scope.

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
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/sessions.routing.e2e-spec.ts test/session-sets.validation.e2e-spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm lint:code`
- `pnpm format:check`
- `pnpm --filter @irontrack/api test:cov`
