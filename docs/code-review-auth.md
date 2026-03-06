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

---

## Verification Pass 6 — 2026-03-05

Verified against current `auth.service.ts` (295 lines), `google-token-verifier.service.ts` (284 lines), `auth.service.spec.ts` (807 lines), and `prisma/schema.prisma`.

| #   | Finding                                        | Status   | Notes                                                                                                                                                                                                                           |
| --- | ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | `register` TOCTOU race leaks P2002 as 500      | ✅ Fixed | `isPrismaUniqueConstraintError` helper + try/catch wraps `user.create` (L50–65). Tests: `maps create-time unique constraint races to EMAIL_TAKEN` (spec L451) and `rethrows unexpected registration create errors` (spec L472). |
| 8   | Dead defensive guards in Google claims check   | ✅ Fixed | Confirmed: `verifyIdToken` check at L97–107 is now `!emailVerified \|\| !hasAudience(...) \|\| !VALID_ISSUERS.has(issuer) \|\| !notExpired` — no `!email`, `!googleId`, `!issuer`.                                              |
| 9   | `googleLogin.create` missing `timezone: 'UTC'` | ✅ Fixed | `timezone: 'UTC'` present at `auth.service.ts:188`. Spec test "applies UTC timezone when creating google-auth users" asserts `create` payload includes `timezone: 'UTC'`.                                                       |
| 10  | `JWT_REFRESH_EXPIRY` parsed twice per issuance | ✅ Fixed | `refreshExpiryMs` computed once at L211–213 and forwarded to `persistRefreshToken(userId, refreshToken, refreshExpiryMs)`.                                                                                                      |
| 11  | `googleLogin` delete-race still issues tokens  | ✅ Fixed | Post-upsert guard at L195–200: `if (user.deletedAt !== null) throw UnauthorizedException`. Spec L740–759 covers the race scenario.                                                                                              |
| 12  | Auth e2e mock drift                            | ✅ Fixed | Confirmed by system-note; e2e flow passes.                                                                                                                                                                                      |

---

## New Findings — 2026-03-05 (Pass 6)

### P2 — Should Fix

#### 13. `AuthService.login` — timing oracle leaks account existence and auth provider (`auth.service.ts:70–93`)

```ts
const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });

if (!user || user.authProvider !== AuthProvider.LOCAL) {
  throw new UnauthorizedException({ ... }); // ← returns immediately, no bcrypt
}

const passwordMatches = await compare(input.password, user.passwordHash); // ← ~100ms
```

`compare` (bcrypt cost 12, ~100ms) is only called when a LOCAL user is found. Missing and Google-auth accounts return in microseconds. An attacker timing responses at the login endpoint can:

1. Enumerate which email addresses are registered (`fast` = not found; `slow` = found and LOCAL).
2. Distinguish LOCAL accounts from GOOGLE-auth accounts (`slow` = LOCAL; `fast` = GOOGLE).

This leaks user enumeration data that `INVALID_CREDENTIALS` messaging is intended to hide.

**Fix:** Always call `compare` against a pre-computed dummy hash to equalize timing:

```ts
const DUMMY_HASH = await hash('dummy-sentinel', 12); // computed once at class init or module level

const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
const isValidUser = !!user && user.authProvider === AuthProvider.LOCAL;
const hashToCompare = isValidUser ? user.passwordHash! : DUMMY_HASH;

const passwordMatches = await compare(input.password, hashToCompare);

if (!isValidUser || !passwordMatches) {
  throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', ... });
}
```

---

#### 14. `AuthService.googleLogin` — silently migrates LOCAL accounts to GOOGLE auth (`auth.service.ts:176–193`)

```ts
const user = await this.prisma.user.upsert({
  where: { email: identity.email },
  update: {
    authProvider: AuthProvider.GOOGLE, // ← overwrites LOCAL → GOOGLE without consent
    googleId: identity.googleId,
    name: identity.name,
    avatarUrl: identity.avatarUrl,
  },
  create: { ... },
});
```

If a user registered locally with `alice@example.com`, then calls `/auth/google` with a Google token for the same email, the `update` branch overwrites `authProvider` to `GOOGLE`. The user loses the ability to log in with their password (`authProvider !== LOCAL` guard in `login` rejects them). This migration is implicit, unconsented, and undocumented.

More critically, if an attacker obtains a valid Google ID token for the victim's email (which requires compromising the victim's Google account), they can permanently lock the victim out of their local login path.

**Fix:** Check whether the existing account uses LOCAL auth, and if so, reject the Google login rather than silently migrating:

```ts
if (existingUser && existingUser.authProvider === AuthProvider.LOCAL) {
  throw new UnauthorizedException({
    code: 'EMAIL_REGISTERED_WITH_PASSWORD',
    message:
      'This email is registered with a password. Please log in with your password.',
  });
}
```

---

### P3 — Nice to Have

#### 15. `isPrismaUniqueConstraintError` catches any P2002, not specifically the email constraint (`auth.service.ts:287–294`)

```ts
function isPrismaUniqueConstraintError(error: unknown): boolean {
  return ... && (error as { code?: unknown }).code === 'P2002';
}
```

The check maps any Prisma unique constraint violation from `user.create` to `EMAIL_TAKEN`. If the `User` schema ever gains another unique field that `register` populates, a P2002 on that field would be silently misreported as `EMAIL_TAKEN`. Prisma's `PrismaClientKnownRequestError` exposes a `meta.target` field containing the constraint name, which can be used for a more precise check.

**Fix:** Import `Prisma` from `@prisma/client` and narrow on `meta.target`:

```ts
import { Prisma } from '@prisma/client';

function isEmailUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray((error.meta as { target?: unknown })?.target) &&
    (error.meta as { target: string[] }).target.includes('email')
  );
}
```

---

## Verification Pass 7 — 2026-03-05

Verified against current `auth.service.ts` (295 lines), `schema.prisma`, and `auth.service.spec.ts` (807 lines).

| #   | Finding                                                       | Status  | Notes                                                                                                                                  |
| --- | ------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | `login` timing oracle leaks account existence / auth provider | ⏳ Open | No dummy-hash equalization in `auth.service.ts:78–83`; fast-path still exits before `compare` for missing/GOOGLE accounts.             |
| 14  | `googleLogin` silently migrates LOCAL accounts to GOOGLE auth | ⏳ Open | `upsert` update branch still overwrites `authProvider: GOOGLE` without checking existing account provider (`auth.service.ts:176–183`). |
| 15  | `isPrismaUniqueConstraintError` catches any P2002             | ⏳ Open | `auth.service.ts:287–294` still matches any Prisma unique violation; `meta.target` not inspected.                                      |
| 16  | `RefreshToken.tokenHash` lacks `@@unique` constraint          | ⏳ Open | `schema.prisma:110` still uses `@@index([tokenHash])`; no migration generated.                                                         |

---

## New Findings — 2026-03-05 (Pass 7)

### P2 — Should Fix

#### 17. `googleLogin` stores a deterministic, low-cost hash of `googleId` as `passwordHash` (`auth.service.ts:186`)

```ts
passwordHash: await hash(identity.googleId, 10),
```

Two problems with this approach:

1. **Cost inconsistency**: `register` uses cost 12 (`hash(input.password, 12)`); Google users get cost 10. While `passwordHash` is never compared for Google accounts today, differing cost factors suggest an unreviewed choice rather than a deliberate policy.

2. **Deterministic value derived from plaintext in the same row**: `identity.googleId` is stored as-is in `User.googleId`. If a future code path ever calls `compare(someInput, user.passwordHash)` without first checking `authProvider`, the raw Google account ID (a public numeric string) would successfully authenticate as the user's "password". Storing a random sentinel instead removes this latent risk entirely.

**Fix:** Replace with a random value at creation time:

```ts
passwordHash: await hash(randomUUID(), 12),
```

---

### P3 — Nice to Have

#### 18. `register` pre-check does not exclude soft-deleted accounts, permanently blocking email reuse (`auth.service.ts:37–39`)

```ts
const existingUser = await this.prisma.user.findUnique({
  where: { email: input.email.toLowerCase() },
  // ← no deletedAt: null filter
});
if (existingUser) {
  this.throwEmailTaken(); // ← fires for soft-deleted users too
}
```

`login` uses `findFirst({ where: { email, deletedAt: null } })` to ignore soft-deleted records. `register` uses `findUnique` without the same guard, so a soft-deleted user permanently blocks that email address for new registrations — there is no re-registration or restoration path. Whether this is intentional policy should be documented; if re-registration is desired, the pre-check should filter `deletedAt: null` (and the DB-level `@unique` on `email` would also need a strategy such as nullifying the email on soft-delete or using a partial index).

**Fix (if re-registration is not desired, at minimum):** Document the policy explicitly. If re-registration _is_ desired, filter soft-deleted records:

```ts
const existingUser = await this.prisma.user.findFirst({
  where: { email: input.email.toLowerCase(), deletedAt: null },
});
```

---

#### 16. `RefreshToken.tokenHash` lacks a `@@unique` constraint (`schema.prisma:109–110`)

```prisma
@@index([tokenHash])   // ← index only; no uniqueness guarantee
```

Each refresh token JWT contains a `jti: randomUUID()`, making SHA-256 collisions cryptographically impossible. However, without a `@@unique` constraint, the DB does not enforce this invariant. A programming bug that accidentally creates two `RefreshToken` rows with the same `tokenHash` would go undetected, leaving the second token as a permanent zombie (never revoked since `refresh` revokes by `id`).

**Fix:** Change `@@index([tokenHash])` to `@@unique([tokenHash])` in `schema.prisma` and generate a migration.

---

## Verification Pass 8 — 2026-03-05

Verified against current `auth.service.ts`, `auth.service.spec.ts`, and Prisma schema/migrations.

| #   | Finding                                                         | Status   | Notes                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | `login` timing oracle leaks account existence / auth provider   | ✅ Fixed | `login` now always runs `bcrypt.compare` with a module-level dummy hash for non-LOCAL/missing users before returning `INVALID_CREDENTIALS`. Tests: `runs bcrypt compare even when login user is missing`, `...for GOOGLE accounts...`. |
| 14  | `googleLogin` silently migrates LOCAL accounts to GOOGLE auth   | ✅ Fixed | Added guard rejecting Google login when an existing active account uses `LOCAL`, with `EMAIL_REGISTERED_WITH_PASSWORD`; `upsert` is skipped in this case.                                                                              |
| 15  | Unique error mapper catches any `P2002`                         | ✅ Fixed | `isEmailUniqueConstraintError` now requires both `code === 'P2002'` and `meta.target` containing `email` (array or string target). Added positive and negative tests.                                                                  |
| 16  | `RefreshToken.tokenHash` lacks `@@unique` constraint            | ✅ Fixed | `schema.prisma` now uses `@@unique([tokenHash])`; migration `202603050003_refresh_token_hash_unique` drops the old non-unique index and creates a unique index.                                                                        |
| 17  | Google create path hashes deterministic `googleId` with cost 10 | ✅ Fixed | Google-user `passwordHash` now uses `hash(randomUUID(), 12)` so it is non-deterministic and aligned with LOCAL hashing cost. Test asserts it does not match `googleId` and uses 12 rounds.                                             |
| 18  | `register` pre-check includes soft-deleted accounts             | ✅ Fixed | Register pre-check now queries active users only (`findFirst` with `deletedAt: null`) to align boundary behavior with login checks. Note: full email reuse remains constrained by DB-level `User.email @unique` policy.                |

---

## New Findings — 2026-03-05 (Pass 8)

### P2 — Should Fix

#### 19. `googleLogin` LOCAL-provider pre-check has the same TOCTOU race as finding #11 (`auth.service.ts:167–201`)

```ts
// Step 1 — read
const existingUser = await this.prisma.user.findFirst({ where: { email } });
if (existingUser?.authProvider === AuthProvider.LOCAL) throw EMAIL_REGISTERED_WITH_PASSWORD;

// ← concurrent register() can insert a LOCAL user here (~50–100ms bcrypt window)

// Step 2 — write
const user = await this.prisma.user.upsert({
  update: { authProvider: AuthProvider.GOOGLE, ... }, // ← overwrites the new LOCAL account
  ...
});
// no authProvider check on the returned `user`
```

If no user exists at step 1, neither guard fires. A concurrent `register` call for the same email can complete (including bcrypt, ~50–100ms) and insert a LOCAL user before step 2. The `upsert` then matches on email and runs its `update` branch, silently setting `authProvider: GOOGLE` on the freshly-created LOCAL account. The post-upsert guard (L203) only checks `deletedAt`, not `authProvider`, so tokens are issued for the now-GOOGLE account.

This is structurally identical to finding #11 (soft-delete race), which was resolved by adding a post-upsert `deletedAt` guard.

**Fix:** Add a matching post-upsert `authProvider` guard immediately after the `upsert`:

```ts
if (user.authProvider !== AuthProvider.GOOGLE) {
  throw new UnauthorizedException({
    code: 'EMAIL_REGISTERED_WITH_PASSWORD',
    message:
      'This email is registered with a password. Please log in with your password.',
  });
}
```

Add a test simulating the race (mock `findFirst` returning `null`, mock `upsert` returning a user with `authProvider: LOCAL`).

---

### P3 — Nice to Have

#### 20. `googleLogin` computes `await hash(randomUUID(), 12)` even for returning users (`auth.service.ts:194`)

```ts
const user = await this.prisma.user.upsert({
  update: { ... },          // ← existing GOOGLE users take this branch
  create: {
    passwordHash: await hash(randomUUID(), 12), // ← evaluated before upsert runs
    ...
  },
});
```

JavaScript evaluates all arguments before calling a function. `hash(randomUUID(), 12)` is awaited as part of building the `create` payload object, so the full bcrypt cost-12 operation (~100ms) runs on every call to `googleLogin` — including for the majority case of a returning GOOGLE user who will trigger only the `update` branch. The generated hash is then discarded.

**Fix:** Restructure to compute the hash only on the create path:

```ts
const existingGoogleUser = await this.prisma.user.findFirst({
  where: { email: identity.email, authProvider: AuthProvider.GOOGLE },
});
const user = existingGoogleUser
  ? await this.prisma.user.update({ where: { id: existingGoogleUser.id }, data: { ... } })
  : await this.prisma.user.create({
      data: { ..., passwordHash: await hash(randomUUID(), 12) },
    });
```

Or use a pre-computed sentinel: `hash('google-sentinel', 1)` (low cost is fine since this value is never compared).

---

#### 21. `DUMMY_PASSWORD_HASH` computed with `hashSync` at module scope (`auth.service.ts:22`)

```ts
const DUMMY_PASSWORD_HASH = hashSync(randomUUID(), 12); // ← top-level, synchronous
```

`hashSync` with cost 12 blocks the Node.js event loop for ~100ms every time this module is first imported. In production this is a one-time startup cost; in test suites that repeatedly re-import or re-compile modules it adds up across runs.

**Fix:** Compute asynchronously in `OnModuleInit` and store on the instance:

```ts
export class AuthService implements OnModuleInit {
  private dummyPasswordHash!: string;

  async onModuleInit() {
    this.dummyPasswordHash = await hash(randomUUID(), 12);
  }
}
```

This moves the ~100ms cost off the synchronous import path onto NestJS's async bootstrap sequence, where it is naturally expected.

---

## Verification Pass 9 — 2026-03-05

Verified against current `auth.service.ts`, `auth.service.spec.ts`, and `auth.e2e-spec.ts`.

| #   | Finding                                                            | Status   | Notes                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | `googleLogin` LOCAL-provider pre-check still has TOCTOU race       | ✅ Fixed | Replaced `upsert` with explicit `update` (existing GOOGLE user) vs `create` (new user) flow, plus create-time email-race recovery that re-reads the concurrent row and rejects LOCAL/deleted outcomes before token issuance.             |
| 20  | `googleLogin` always computes bcrypt hash even for returning users | ✅ Fixed | Hashing now happens only inside create path (`createOrRecoverGoogleUser`), so returning GOOGLE users only hit `user.update` with no new hash computation. Added test: `does not compute a new password hash for returning GOOGLE users`. |
| 21  | `DUMMY_PASSWORD_HASH` uses module-scope `hashSync`                 | ✅ Fixed | Replaced synchronous runtime hash with a precomputed bcrypt hash constant, eliminating startup/event-loop blocking at module import time.                                                                                                |

Validation:

- `pnpm --filter @irontrack/api test -- --runTestsByPath src/modules/auth/auth.service.spec.ts` ✅
- `pnpm --filter @irontrack/api test:e2e -- --runTestsByPath test/auth.e2e-spec.ts` ✅
- `pnpm --filter @irontrack/api typecheck` ✅
- `pnpm --filter @irontrack/api test:cov` ✅ (`100/100/100`)
