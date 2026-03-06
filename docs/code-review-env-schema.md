# Code Review — Env Schema (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-05

## Scope

- `apps/api/src/config/env.schema.ts`
- `apps/api/src/config/env.schema.spec.ts`
- `apps/api/src/common/validation/string-normalization.ts`
- `apps/api/src/common/utils/api-prefix.ts`
- `apps/api/src/main.ts`

## Status

- Total findings: **87**
- Open: **0**
- Fixed: **87**

## Fixed History

- `#1–#21`: baseline normalization, secret handling, duration parsing, URL validation, and missing coverage.
- `#22–#42`: Zod issue clarity, cross-field duration checks, production URL rules, and API-prefix invariants.
- `#43–#61`: normalization dedupe, assertion hardening, protocol/boundary gaps, and broader acceptance/rejection coverage.
- `#62–#76`: stricter HTTPS semantics, order-insensitive assertions, and additional boundary/permutation coverage.
- `#77–#87`: helper hardening, CORS/API-prefix edge cases, and defensive `superRefine` URL handling.

## Key Outcomes

- Env parsing is normalized at the schema boundary instead of in downstream consumers.
- JWT expiry config now has format, upper-bound, and cross-field safety checks.
- Production-only HTTPS requirements for callback and service URLs are explicit and hardened.
- CORS parsing is stricter and bootstrap config consumption now matches schema guarantees.

## Validation

- `pnpm --filter @irontrack/api typecheck`
- `pnpm --filter @irontrack/api test:cov`
