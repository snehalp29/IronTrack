# Code Review — Env Schema

Scope: `env.schema.ts`, its specs, shared normalization helpers, API-prefix utility, and bootstrap config consumption.

Status: `87 total` | `87 fixed` | `0 open`

Fixed: `#1–#42` normalization, secret handling, duration parsing, URL validation, cross-field checks, and API-prefix invariants; `#43–#87` boundary/permutation coverage, stricter HTTPS and CORS semantics, helper hardening, and defensive `superRefine` behavior.

Outcomes: env parsing is normalized at the schema boundary, JWT expiry config has format/bound/cross-field safety checks, and production HTTPS/CORS requirements are explicit and hardened.

Validation: `pnpm --filter @irontrack/api typecheck` and `pnpm --filter @irontrack/api test:cov`.
