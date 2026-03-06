# Code Review — Auth Module (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-06

## Scope

- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/google-token-verifier.service.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/strategies/*.ts`
- Related auth tests (`*.spec.ts`, `apps/api/test/auth.e2e-spec.ts`)

## Status

- Total findings: **23**
- Open: **0**
- Fixed: **23**

## Fixed History

- `#1–#6`: account-state enforcement, verifier hardening, expiry parsing, unused strategy cleanup, and initial coverage gaps.
- `#7–#12`: register race handling, auth e2e/query-shape alignment, delete races, and redundant defensive-path cleanup.
- `#13–#17`: login timing-oracle reduction, provider-migration prevention, unique-error scoping, token-hash uniqueness, and safer Google-user creation.
- `#18–#21`: soft-delete edge cases, `googleLogin` TOCTOU tightening, unnecessary bcrypt work removal, and startup blocking cleanup.
- `#22`: Google multi-audience token verification now requires `azp` to match the configured client id.
- `#23`: auth endpoints now issue refresh tokens through an httpOnly cookie, accept cookie-backed refresh/logout requests, and stop returning the long-lived refresh token in JSON bodies.

## Key Outcomes

- Token issuance now consistently requires an active, non-deleted account.
- Google auth no longer silently migrates password users or races into invalid provider states.
- Refresh-token rotation and persistence are stricter and more deterministic, and the browser refresh path no longer depends on a JavaScript-readable refresh token.
- Verifier and module boot paths are leaner, safer, and fully covered by unit/e2e tests.

## Validation

- `pnpm --filter @irontrack/api test -- --runTestsByPath src/modules/auth/auth.controller.spec.ts src/modules/auth/auth.service.spec.ts src/modules/auth/dto/auth.schemas.spec.ts`
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/auth.e2e-spec.ts`
- `pnpm --filter @irontrack/api typecheck`
