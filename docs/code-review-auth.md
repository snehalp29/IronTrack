# Code Review — Auth Module

Scope: auth controller, service, module, Google verifier, strategies, related unit specs, and `apps/api/test/auth.e2e-spec.ts`.

Status: `23 total` | `23 fixed` | `0 open`

Fixed History:

- `#1–#6`: account-state enforcement, verifier hardening, expiry parsing, unused strategy cleanup, and initial coverage gaps.
- `#7–#12`: register race handling, e2e/query-shape alignment, delete races, and defensive-path cleanup.
- `#13–#17`: login timing-oracle reduction, provider-migration prevention, unique-error scoping, token-hash uniqueness, and safer Google-user creation.
- `#18–#23`: soft-delete edge cases, `googleLogin` TOCTOU tightening, unnecessary bcrypt work removal, startup blocking cleanup, multi-audience `azp` enforcement, and httpOnly refresh/logout flow.

Outcomes:

- Token issuance consistently requires an active, non-deleted account.
- Google auth no longer migrates password users or races into invalid provider states.
- Refresh-token handling is stricter and no longer depends on a JS-readable long-lived token.

Validation:

- `pnpm --filter @irontrack/api test -- --runTestsByPath src/modules/auth/auth.controller.spec.ts src/modules/auth/auth.service.spec.ts src/modules/auth/dto/auth.schemas.spec.ts`
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/auth.e2e-spec.ts`
- `pnpm --filter @irontrack/api typecheck`
