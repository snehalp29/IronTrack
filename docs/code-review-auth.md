# Code Review — Auth Module

Scope: auth controller, service, module, Google verifier, strategies, related unit specs, and `apps/api/test/auth.e2e-spec.ts`.

Status: `23 total` | `23 fixed` | `0 open`

Fixed:

- `#1–#12`: account-state enforcement, verifier hardening, expiry parsing, register/delete races, and early coverage gaps.
- `#13–#23`: login timing-oracle reduction, provider-migration prevention, unique-error scoping, safer Google-user creation, `azp` enforcement, and httpOnly refresh/logout flow.

Outcomes:

- Token issuance consistently requires an active, non-deleted account.
- Google auth no longer migrates password users or races into invalid provider states.
- Refresh-token handling no longer depends on a JS-readable long-lived token.

Validation:

- Targeted auth unit specs, `test/auth.e2e-spec.ts`, and `pnpm --filter @irontrack/api typecheck`.
