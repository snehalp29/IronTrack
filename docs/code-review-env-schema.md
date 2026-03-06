# Code Review — Env Schema

Scope: `env.schema.ts`, its specs, shared normalization helpers, API-prefix utility, and bootstrap config consumption.

Status: `87 total` | `87 fixed` | `0 open`

Fixed History:

- `#1–#21`: baseline normalization, secret handling, duration parsing, URL validation, and missing coverage.
- `#22–#42`: Zod issue clarity, cross-field duration checks, production URL rules, and API-prefix invariants.
- `#43–#61`: normalization dedupe, assertion hardening, protocol/boundary gaps, and broader acceptance/rejection coverage.
- `#62–#76`: stricter HTTPS semantics, order-insensitive assertions, and additional boundary/permutation coverage.
- `#77–#87`: helper hardening, CORS/API-prefix edge cases, and defensive `superRefine` URL handling.

Outcomes:

- Env parsing is normalized at the schema boundary instead of downstream.
- JWT expiry config has format, bound, and cross-field safety checks.
- Production HTTPS and CORS requirements are explicit and hardened.

Validation:

- `pnpm --filter @irontrack/api typecheck`
- `pnpm --filter @irontrack/api test:cov`
