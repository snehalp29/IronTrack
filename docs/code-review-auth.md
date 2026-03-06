# Code Review — Auth Module (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-05  
**Scope:**

- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/google-token-verifier.service.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/strategies/*.ts`
- Related auth tests (`*.spec.ts`, `apps/api/test/auth.e2e-spec.ts`)

---

## Current Status

- Total findings tracked: **21**
- Open findings: **0**
- Fixed findings: **21**
- All historical TypeScript/Prisma snippets for fixed findings were removed to keep this document lightweight.

---

## Findings Index

| #   | Severity | Finding (Short)                                               | Status   |
| --- | -------- | ------------------------------------------------------------- | -------- |
| 1   | P1       | Soft-deleted users could mint tokens via login/refresh/google | ✅ Fixed |
| 2   | P1       | Google token verification lacked fetch timeout/abort          | ✅ Fixed |
| 3   | P2       | Refresh expiry parsing silently defaulted on invalid values   | ✅ Fixed |
| 4   | P2       | Legacy Google strategy maintained without runtime usage       | ✅ Fixed |
| 5   | P3       | DTO schema tests only covered register normalization path     | ✅ Fixed |
| 6   | P1       | Refresh rotation could re-issue same token in same second     | ✅ Fixed |
| 7   | P2       | Register race could leak Prisma P2002 as 500                  | ✅ Fixed |
| 8   | P3       | Dead defensive guards after Google claims schema parse        | ✅ Fixed |
| 9   | P3       | Google create path missed explicit timezone default           | ✅ Fixed |
| 10  | P3       | Refresh expiry parsed twice per token issuance                | ✅ Fixed |
| 11  | P1       | `googleLogin` delete-race could still issue tokens            | ✅ Fixed |
| 12  | P2       | Auth e2e refresh mock drift from production query shape       | ✅ Fixed |
| 13  | P2       | Login timing oracle leaked account/provider hints             | ✅ Fixed |
| 14  | P2       | `googleLogin` silently migrated LOCAL to GOOGLE               | ✅ Fixed |
| 15  | P3       | Broad unique-error mapper matched any P2002                   | ✅ Fixed |
| 16  | P3       | `RefreshToken.tokenHash` lacked DB uniqueness guarantee       | ✅ Fixed |
| 17  | P2       | Google create path used deterministic `googleId`-derived hash | ✅ Fixed |
| 18  | P3       | Register pre-check behavior with soft-deleted records         | ✅ Fixed |
| 19  | P2       | `googleLogin` LOCAL-provider TOCTOU race persisted            | ✅ Fixed |
| 20  | P3       | `googleLogin` computed bcrypt hash for returning users        | ✅ Fixed |
| 21  | P3       | Module-scope `hashSync` startup blocking for dummy hash       | ✅ Fixed |

---

## Verification Summary

| Pass | Date       | Focus                               | Result                       |
| ---- | ---------- | ----------------------------------- | ---------------------------- |
| 1    | 2026-03-05 | Findings 1–5                        | ✅ Fixed                     |
| 2    | 2026-03-05 | Finding 6 (and tracked 7 follow-up) | ✅ Fixed                     |
| 3    | 2026-03-05 | Findings 7, 9                       | ✅ Fixed                     |
| 4    | 2026-03-05 | Findings 11, 12                     | ✅ Fixed                     |
| 5    | 2026-03-05 | Findings 8, 10                      | ✅ Fixed                     |
| 6    | 2026-03-05 | Re-validation of 7–12               | ✅ Verified                  |
| 7    | 2026-03-05 | Findings 13–16 status check         | ✅ Addressed in later passes |
| 8    | 2026-03-05 | Findings 13, 14, 15, 16, 17, 18     | ✅ Fixed                     |
| 9    | 2026-03-05 | Findings 19, 20, 21                 | ✅ Fixed                     |

---

## Key Implemented Outcomes

- Token issuance now consistently enforces active-account state (including deleted-account and race windows).
- Google login flow now avoids unintended auth-provider migration and hardens create/update race behavior.
- Refresh-token lifecycle is stronger (`jti` uniqueness, DB uniqueness on token hash, stricter error mapping).
- Security-sensitive verifier paths are hardened (timeout/abort behavior and cleaner claims checks).
- Auth tests were expanded across unit and e2e paths to protect all identified regression points.

---

## Validation Commands

- `pnpm --filter @irontrack/api test -- --runTestsByPath src/modules/auth/auth.service.spec.ts`
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/auth.e2e-spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm --filter @irontrack/api test:cov`

Latest recorded auth validation result: ✅ passing (including strict coverage gate).
