# Code Review — Auth Module

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

## Findings

### P1 — Must Fix

#### 1) Disabled/deleted users can still mint new tokens on auth endpoints

**Files/lines:**

- `apps/api/src/modules/auth/auth.service.ts:62-67` (`login`)
- `apps/api/src/modules/auth/auth.service.ts:87-94` and `119` (`refresh`)
- `apps/api/src/modules/auth/auth.service.ts:147-166` (`googleLogin`)
- `apps/api/src/modules/auth/auth.service.ts:237-243` (`validateUserFromPayload`)

`validateUserFromPayload` correctly enforces `deletedAt: null`, but token-issuing paths do not. This allows soft-deleted users to continue obtaining fresh access/refresh tokens from `login`, `refresh`, and `googleLogin`.

Even though protected endpoints later reject those access tokens, this still violates auth-state consistency and can create unnecessary refresh-token churn for disabled accounts.

**Recommended fix:**

- Enforce `deletedAt: null` in `login` user lookup.
- In `refresh`, reject when `stored.user.deletedAt` is set before issuing tokens.
- In `googleLogin`, explicitly handle existing deleted users (reject or define restore flow).
- Add unit/e2e tests for deleted-user behavior across login/refresh/google.

---

#### 2) Google ID token verification has no fetch timeout/abort

**Files/lines:**

- `apps/api/src/modules/auth/google-token-verifier.service.ts:181-186`

`fetch(GOOGLE_JWKS_URL)` is called without timeout. If the upstream hangs or the network stalls, requests to `/auth/google` can stay open for a long time, reducing API availability under load.

**Recommended fix:**

- Add `AbortController` with bounded timeout (for example 3–5s) and handle abort as token-verification failure.
- Add tests covering timeout path.

---

### P2 — Should Fix

#### 3) Refresh-expiry parsing silently falls back to 7 days on invalid input

**Files/lines:**

- `apps/api/src/modules/auth/auth.service.ts:213-218`

`parseDurationToMs` returns a default `7d` when parsing fails, while `AuthModule` access-expiry parsing throws for invalid input and env schema is strict. This inconsistency can hide misconfiguration in non-standard boot paths/tests.

**Recommended fix:**

- Reuse a single strict duration parser (prefer shared env/validation helper).
- Throw on invalid duration instead of silently defaulting.

---

#### 4) Legacy Google Passport strategy is maintained but not wired into runtime auth flow

**Files/lines:**

- `apps/api/src/modules/auth/auth.module.ts:31` (providers exclude `GoogleStrategy`)
- `apps/api/src/modules/auth/strategies/google.strategy.ts` (unused strategy)

Current Google auth flow uses ID-token verification service (`/auth/google`), not `AuthGuard('google')`. Keeping an unused OAuth strategy increases configuration surface and maintenance burden.

**Recommended fix:**

- Remove the strategy if not needed, or
- Wire full redirect/callback flow and add route/guard tests.

---

### P3 — Nice To Have

#### 5) Auth schema unit tests cover only register normalization paths

**Files/lines:**

- `apps/api/src/modules/auth/dto/auth.schemas.spec.ts:1-35`

Schema tests currently focus on `registerSchema` trimming behavior. Boundary tests for `loginSchema`, `refreshSchema`, and `googleAuthSchema` live indirectly in controller tests, but direct schema-level tests would make constraints clearer and more stable.

**Recommended fix:**

- Add direct DTO tests for min lengths and invalid payloads (`refreshToken`, `idToken`, login fields).

---

## Notes

- Overall structure is solid: token rotation (`refresh` revocation), JWT guard/public decorator pattern, and Google claim verification are all implemented with good baseline rigor.
- Main risk to address first is auth-state consistency for deleted accounts and external dependency timeout hardening in Google verification.

---

## Follow-up Pass (2026-03-05)

### P1 — Must Fix

#### 6) Refresh-token rotation can re-issue an identical token when calls happen in the same second

**Files/lines:**

- `apps/api/src/modules/auth/auth.service.ts:189-202` (`issueTokens`)

Refresh tokens are signed from a deterministic payload (`sub`, `email`) with fixed options. JWT signing includes second-resolution `iat` by default, so issuing a new refresh token within the same second can produce the same token string as the old one.

That weakens rotation guarantees because a “rotated” token may be indistinguishable from the prior token in storage (same hash), making single-use semantics brittle.

**Recommended fix:**

- Add a per-issuance unique claim for refresh tokens (for example `jti`/nonce via `randomUUID()`).
- Add a unit test with frozen time to assert that consecutive refresh token issues are distinct.
