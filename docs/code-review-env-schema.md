# Code Review — Env Schema

Branch: `phase_one`  
Date: `2026-03-05`

Scope: `env.schema.ts`, its specs, shared normalization helpers, API-prefix utility, and bootstrap config consumption.

Status: `87 total` | `87 fixed` | `0 open`

Fixed:

- `#1–#21`: baseline normalization, secret handling, duration parsing, URL validation, missing coverage.
- `#22–#42`: Zod issue clarity, cross-field duration checks, production URL rules, API-prefix invariants.
- `#43–#61`: normalization dedupe, assertion hardening, protocol/boundary gaps, broader acceptance/rejection coverage.
- `#62–#76`: stricter HTTPS semantics, order-insensitive assertions, additional boundary/permutation coverage.
- `#77–#87`: helper hardening, CORS/API-prefix edge cases, defensive `superRefine` URL handling.

Outcomes:

- Env parsing is normalized at the schema boundary instead of downstream.
- JWT expiry config now has format, bound, and cross-field safety checks.
- Production HTTPS and CORS requirements are explicit and hardened.

Validation:

- `pnpm --filter @irontrack/api typecheck`
- `pnpm --filter @irontrack/api test:cov`
