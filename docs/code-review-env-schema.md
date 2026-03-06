# Code Review — Env Schema (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-05  
**Scope:**

- `apps/api/src/config/env.schema.ts`
- `apps/api/src/config/env.schema.spec.ts`
- `apps/api/src/common/validation/string-normalization.ts`
- `apps/api/src/common/utils/api-prefix.ts`
- `apps/api/src/main.ts` (config consumption alignment)

---

## Current Status

- Total findings tracked: **87**
- Open findings: **0**
- Fixed findings: **87**
- Historical code snippets and pass-by-pass duplicates were removed to keep this document canonical and lightweight.

---

## Findings Summary

- `#1–#10` ✅ Fixed: baseline env normalization, secret handling, duration and URL validation, and missing test coverage.
- `#11–#21` ✅ Fixed: CORS validation clarity, duration/cross-field guards, and associated branch coverage.
- `#22–#30` ✅ Fixed: Zod issue typing decisions, cross-unit duration checks, production URL checks, and config/default consistency.
- `#31–#42` ✅ Fixed: production URL scheme hardening, boundary tests, direct helper tests, API prefix normalization invariants, and test-structure cleanup.
- `#43–#61` ✅ Fixed: normalization duplication removal, assertion-pattern hardening, protocol/boundary gaps, and additional rejection/acceptance cases.
- `#62–#76` ✅ Fixed: strict HTTPS enforcement semantics, brittle order-sensitive assertions, and extended boundary/permutation coverage.
- `#77–#87` ✅ Fixed: remaining multi-concern assertion splits, CORS/API prefix type-path coverage, helper robustness, and super-refine URL-crash hardening.

---

## Final Resolutions (Key Outcomes)

- Env parsing is now normalized at the schema boundary for critical string fields (including API prefix handling).
- JWT duration validation now has:
  - strict format checks,
  - upper bounds per token type,
  - cross-field constraint (`access < refresh`) with proper guard conditions.
- Production URL security checks were hardened to require HTTPS semantics robustly (including scheme-variant handling).
- CORS origin parsing now validates entry structure and origin correctness with clearer error intent.
- `superRefine` URL protocol checks were made defensive against malformed URL inputs to avoid runtime throws.
- Test suite was expanded and normalized for strict branch coverage:
  - explicit boundary-value tests,
  - permutation coverage for partial OAuth configs,
  - split assertions to avoid masked failures,
  - helper-level tests for defensive branches.
- Config consumption in bootstrap paths was aligned with validated schema guarantees (`getOrThrow` style where appropriate).

---

## Validation Snapshot

- `pnpm --filter @irontrack/api typecheck` ✅
- `pnpm --filter @irontrack/api test:cov` ✅ (`100/100/100/100`)
