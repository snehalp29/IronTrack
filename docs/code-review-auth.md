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

## Verification Pass 1 — 2026-03-05

| #   | Finding                                          | Status   | Notes                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Disabled/deleted users can still mint new tokens | ✅ Fixed | `login` adds `deletedAt: null` (L66); `refresh` checks `stored.user.deletedAt !== null` (L123–128); `googleLogin` checks `existingUser?.deletedAt` (L161–166). Tests: "rejects login for soft-deleted local users", "rejects refresh token for soft-deleted users", "rejects google login for soft-deleted accounts" |
| 2   | Google JWKS fetch has no timeout                 | ✅ Fixed | `AbortController` + `GOOGLE_JWKS_REQUEST_TIMEOUT_MS = 5000` added at `google-token-verifier.service.ts:182–198`. Test "aborts stalled JWKS fetches" covers abort path.                                                                                                                                               |
| 3   | Refresh-expiry parsing silently falls back to 7d | ✅ Fixed | `parseDurationToMs` now throws on invalid or non-positive duration (L238–246). Test "parses configured JWT duration strings" covers throw paths for `'invalid'` and `'0m'`.                                                                                                                                          |
| 4   | Legacy `GoogleStrategy` maintained but not wired | ✅ Fixed | `GoogleStrategy` excluded from `AuthModule` providers (L31). `auth.module.spec.ts` asserts it is not registered. File retained for potential future redirect-flow use but carries no runtime cost.                                                                                                                   |
| 5   | Schema tests cover only register paths           | ✅ Fixed | `auth.schemas.spec.ts` now includes tests for `loginSchema` (invalid email, short password), `refreshSchema` (min length), and `googleAuthSchema` (min length).                                                                                                                                                      |

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

#### 7) Register race can leak Prisma `P2002` as a 500 instead of `EMAIL_TAKEN`

**Files/lines:**

- `apps/api/src/modules/auth/auth.service.ts:36-57` (`register`)

`register` pre-checks `findUnique(email)` and then inserts. Under concurrent requests for the same email, both can pass the pre-check and one insert will fail with Prisma unique-constraint (`P2002`). Without explicit mapping, that bubble-up becomes a generic 500 response instead of the intended `EMAIL_TAKEN`.

**Recommended fix:**

- Catch unique-constraint errors from `user.create` and map to `BadRequestException` with `{ code: 'EMAIL_TAKEN', message: 'Email already in use' }`.
- Add a unit test simulating a create-time `P2002` race.

---

## Verification Pass 2 — 2026-03-05

| #   | Finding                                                            | Status   | Notes                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6   | Refresh-token rotation can re-issue identical token in same second | ✅ Fixed | `jti: randomUUID()` added to `refreshPayload` at `auth.service.ts:195–198`. Test "issues a distinct refresh token on rotation even within the same second" (spec L604–629) freezes `Date.now` and asserts tokens differ. |

---

## New Findings — 2026-03-05 (Pass 2)

### P2 — Should Fix

#### 7. `AuthService.register` — TOCTOU race condition between `findUnique` and `create` (`auth.service.ts:37–57`)

```ts
const existingUser = await this.prisma.user.findUnique({
  where: { email: input.email.toLowerCase() },
});

if (existingUser) {
  throw new BadRequestException({ code: 'EMAIL_TAKEN', ... });
}

const passwordHash = await hash(input.password, 12); // ← window here (~50ms)
const user = await this.prisma.user.create({ ... }); // ← P2002 if concurrent call wins
```

Two concurrent registration requests for the same email can both see `existingUser === null`, both call `user.create`, and the second throws `PrismaClientKnownRequestError` with code `P2002`. The error is uncaught and propagates as a 500.

The `bcrypt.hash` call with cost 12 introduces a window of ~50–100 ms between the check and the insert, making the race non-negligible.

**Fix:** Catch `P2002` from `create` and convert it to the same `EMAIL_TAKEN` response:

```ts
import { Prisma } from '@prisma/client';

try {
  const user = await this.prisma.user.create({ data: { ... } });
  return this.issueTokens(user.id, user.email);
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new BadRequestException({ code: 'EMAIL_TAKEN', message: 'Email already in use' });
  }
  throw err;
}
```

---

### P3 — Nice to Have

#### 8. `GoogleTokenVerifierService.verifyIdToken` — three dead defensive guards after Zod validation (`google-token-verifier.service.ts:97–110`)

```ts
const email = payload.email.toLowerCase();   // guaranteed non-empty by z.string().email()
const googleId = payload.sub;                // guaranteed non-empty by z.string().min(1)
const issuer = payload.iss;                  // guaranteed non-empty by z.string().min(1)

if (
  !email ||    // ← always false: email is a valid, non-empty string
  !googleId || // ← always false: sub is min(1)
  !issuer ||   // ← always false: iss is min(1)
  ...
) { ... }
```

`email`, `googleId`, and `issuer` all passed `googleTokenClaimsSchema.safeParse` before reaching this check. Their Zod constraints (`z.string().email()`, `z.string().min(1)`) guarantee they are non-empty truthy strings. The three `!` checks are dead code and add noise to the security-critical claims validation block.

**Fix:** Remove `!email`, `!googleId`, and `!issuer` from the condition — they can never be falsy here.

---

#### 9. `AuthService.googleLogin` — `create` branch omits `timezone` default, inconsistent with `register` (`auth.service.ts:177–183`)

```ts
create: {
  email: identity.email,
  passwordHash: await hash(identity.googleId, 10),
  authProvider: AuthProvider.GOOGLE,
  googleId: identity.googleId,
  name: identity.name,
  avatarUrl: identity.avatarUrl,
  // ← timezone not set; falls back to DB/Prisma schema default (likely null)
},
```

`register` explicitly sets `timezone: input.timezone ?? 'UTC'`, ensuring a valid default for all local accounts. New Google users created via the `googleLogin` path receive whatever the DB column default is. If that default is `null`, `StreakService.incrementStreak` will fall back to `UTC` (via `user.timezone ?? 'UTC'`), but the stored `null` is semantically different from an explicit `'UTC'` — it signals "unset" rather than "known UTC preference".

**Fix:** Add `timezone: 'UTC'` to the `create` payload, matching the `register` default.

---

#### 10. `AuthService.issueTokens` — `JWT_REFRESH_EXPIRY` parsed twice per token issuance (`auth.service.ts:200–218`)

```ts
// First parse — for the JWT expiresIn option
expiresIn: this.parseDurationToMs(
  this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY'),
) / 1000,

// Second parse — inside persistRefreshToken → getRefreshTokenExpiry
private getRefreshTokenExpiry(): Date {
  const expiry = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRY');
  return new Date(Date.now() + this.parseDurationToMs(expiry));
}
```

`JWT_REFRESH_EXPIRY` is read from config and parsed twice on every token issuance. The two computed values should always be identical, but the duplication creates a small inconsistency risk and minor overhead.

**Fix:** Compute the expiry duration once in `issueTokens` and pass the value to `persistRefreshToken`.

---

## Verification Pass 3 — 2026-03-05

| #   | Finding                                              | Status   | Notes                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Register race can leak `P2002` as 500                | ✅ Fixed | `register` now catches unique-constraint errors and maps to `EMAIL_TAKEN` (`auth.service.ts:50–64`). Tests: `maps create-time unique constraint races to EMAIL_TAKEN` and `rethrows unexpected registration create errors`. |
| 9   | Google create branch omits explicit timezone default | ✅ Fixed | `googleLogin` create payload now sets `timezone: 'UTC'` (`auth.service.ts:178–183`). Test: `applies UTC timezone when creating google-auth users`.                                                                          |

Remaining optional items from pass 2: #8 (dead guards cleanup) and #10 (expiry parse dedup).

---

## New Findings — 2026-03-05 (Pass 4)

### P1 — Must Fix

#### 11) `googleLogin` can still mint tokens if account is soft-deleted between pre-check and upsert

**Files/lines:**

- `apps/api/src/modules/auth/auth.service.ts:158-186`

`googleLogin` checks for deleted user before `upsert`, but a concurrent soft-delete between that check and the `upsert` call can still return a deleted record. Without a post-upsert deleted check, token issuance can proceed for a disabled account.

**Fix:** Add a post-upsert guard (`if (user.deletedAt !== null)`) before `issueTokens`.

### P2 — Should Fix

#### 12) Auth e2e mock drift from production refresh revocation query

**Files/lines:**

- `apps/api/test/auth.e2e-spec.ts:70-184`

The e2e mock for `refreshToken.updateMany` only matched `tokenHash` + `revokedAt`, while production refresh revocation uses `id` + `revokedAt` + `expiresAt`. This caused false negative 401s in e2e flow.

**Fix:** Align e2e mock type and matching logic with the production query shape.

---

## Verification Pass 4 — 2026-03-05

| #   | Finding                                          | Status   | Notes                                                                                                                                                             |
| --- | ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | `googleLogin` delete-race can still issue tokens | ✅ Fixed | Added post-upsert guard in `auth.service.ts` and unit test: `rejects google login when account becomes soft-deleted before token issuance`.                       |
| 12  | Auth e2e refresh flow mock drift                 | ✅ Fixed | Updated `auth.e2e-spec.ts` mock `updateMany` shape/logic to support `id`/`expiresAt` paths; e2e flow (`register -> login -> refresh -> logout`) now passes again. |

---

## Verification Pass 5 — 2026-03-05

| #   | Finding                                      | Status   | Notes                                                                                                                                                                   |
| --- | -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Dead defensive guards in Google claims check | ✅ Fixed | Removed unreachable `!email`, `!googleId`, `!issuer` checks after schema parse in `google-token-verifier.service.ts:97-104`; behavior preserved by existing tests.      |
| 10  | Refresh expiry parsed twice per issuance     | ✅ Fixed | `issueTokens` now parses `JWT_REFRESH_EXPIRY` once and passes `refreshExpiryMs` to `persistRefreshToken`; added test `parses refresh duration once per token issuance`. |
