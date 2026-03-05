# Code Review — `env.schema.ts` & `env.schema.spec.ts`

**Branch:** `phase_one`
**Date:** 2026-03-04
**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`, `apps/api/src/common/validation/string-normalization.ts`

---

## Summary of the Diff

The change fixes a silent bug where root-level Zod parse failures (path = `[]`) produced error messages like `: Invalid input` instead of `<root>: Invalid input`. The fix is correct. A corresponding regression test was added.

---

## Findings

### P1 — Must Fix

#### 1. JWT secrets are not trimmed (`env.schema.ts:46-47`)

```ts
JWT_ACCESS_SECRET: z.string().min(16),
JWT_REFRESH_SECRET: z.string().min(16),
```

Unlike `DATABASE_URL` (which applies `trimString` via `z.preprocess`), the JWT secrets receive no whitespace normalization. A secret value of `'  mysecret_value  '` (18 chars total) passes the `min(16)` guard but is stored with embedded whitespace. This causes hard-to-diagnose token verification failures when the secret is consumed by the JWT library, since the actual signing key differs from what was intended.

**Fix:** Wrap both fields with `z.preprocess(trimString, z.string().min(16))`.

---

#### 2. Identical JWT secrets in every test case (`env.schema.spec.ts`)

```ts
JWT_ACCESS_SECRET: '1234567890abcdef',
JWT_REFRESH_SECRET: '1234567890abcdef',   // same value in all ~15 test cases
```

Both secrets are set to the same value in every test. The schema does not prevent this, but it normalises tests to an insecure pattern that leaks into developer expectations. If a future validation rule (or a SuperRefine check) is added to assert the two secrets must differ, none of these tests would catch a regression. Additionally, `'1234567890abcdef'` is exactly 16 characters — the minimum — so tests are always passing at the lowest acceptable bound rather than using realistic values.

**Fix:** Use distinct values that are clearly over-length, e.g.
`JWT_ACCESS_SECRET: 'access-secret-for-testing-only'`
`JWT_REFRESH_SECRET: 'refresh-secret-for-testing-only'`

---

### P2 — Should Fix

#### 3. No minimum length or format enforcement on `GOOGLE_CLIENT_SECRET` (`env.schema.ts:51`)

```ts
GOOGLE_CLIENT_SECRET: optionalTrimmedStringSchema,
```

`optionalTrimmedStringSchema` resolves to `z.string().optional()` — any non-empty string passes. A one-character secret is accepted. Google OAuth client secrets have a well-known format and length. At minimum a `min(10)` guard would catch obvious misconfiguration.

**Fix:** Apply a minimum length (e.g., `.min(10)`) to `GOOGLE_CLIENT_SECRET` inside a separate schema, or add a comment noting that format is intentionally unconstrained (to allow test/mock values).

---

#### 4. `CORS_ORIGINS` is accepted as a free-form string with no origin validation (`env.schema.ts:57-64`)

```ts
CORS_ORIGINS: z.preprocess(
  trimStringOrUndefined,
  z.string().default('http://localhost:3000,...'),
),
```

The value is consumed later as a comma-separated list of origins, but the schema accepts any non-empty string. A typo like `http//localhost:3000` or an accidental newline in the middle of the string passes silently and causes CORS to misbehave at runtime rather than at startup.

**Fix:** Add a `refine` or `transform` that splits on commas and validates each segment with `z.string().url()`, or at minimum trims each segment. If parsing in a transform, the inferred type of `CORS_ORIGINS` should become `string[]` to make downstream usage safer.

---

#### 5. No validation that `ML_SERVICE_URL` uses HTTPS in production (`env.schema.ts:53-56`)

```ts
ML_SERVICE_URL: z.preprocess(
  trimStringOrUndefined,
  z.string().url().default('http://localhost:5000'),
),
```

The field accepts any valid URL including plain `http://`. In production, communicating with the ML service over unencrypted HTTP is a security risk (data interception, token leakage if auth headers are used). The `superRefine` block already enforces production-specific checks for Google OAuth — a similar guard for `ML_SERVICE_URL` would be consistent.

**Fix:** Inside `superRefine`, when `env.NODE_ENV === 'production'` and `env.ML_SERVICE_URL.startsWith('http://')`, add a `ZodIssueCode.custom` issue.

---

#### 6. New test (line 253–256) does not follow file formatting conventions (`env.schema.spec.ts:253-256`)

```ts
it('formats root-level validation errors with an explicit root path', () => {
  expect(() =>
    validateEnv('invalid-config' as unknown as Record<string, unknown>),
  ).toThrow(
    /Invalid environment configuration: <root>: Invalid input: expected object, received string/,
  );
});
```

The `expect(...).toThrow(...)` spans two lines here with the `.toThrow` on its own line. Every other test in the file chains `.toThrow(...)` inline within a wrapping call or keeps the assertion on one line. This is a minor inconsistency but matters for maintainability in a project with ESLint max-line-length rules.

**Fix:** Reformat to match the existing pattern — either keep the full assertion on one logical line or extract the regex to a named variable.

---

#### 7. Missing test coverage for `API_PORT` coercion and rejection (`env.schema.spec.ts`)

```ts
API_PORT: z.coerce.number().int().positive().default(3000),
```

The schema coerces `API_PORT` from a string, enforces integer and positive constraints, and defaults to `3000`. The spec file has no tests for:

- String-to-number coercion (`'8080'` → `8080`)
- Rejection of negative ports (`-1`)
- Rejection of zero (`0`)
- Rejection of non-numeric strings (`'abc'`)
- Rejection of floats (`'8080.5'`)

Given the project's **100% branch/statement/function coverage** requirement, these missing paths are likely failing the coverage threshold or being soft-excluded.

**Fix:** Add test cases covering each of the above scenarios.

---

#### 8. No test for `ML_SERVICE_URL` invalid URL rejection (`env.schema.spec.ts`)

There is no test that passes an invalid URL for `ML_SERVICE_URL` (e.g., `'not-a-url'`). The field uses `z.string().url()` which will throw, but this is untested. Under the 100% branch coverage threshold, the error path in `z.string().url()` may not be exercised.

**Fix:** Add a test asserting that an invalid `ML_SERVICE_URL` value throws with an appropriate message.

---

### P3 — Nice to Have

#### 9. `durationSchema` allows arbitrarily large values (`env.schema.ts:8-14`)

```ts
const durationSchema = z.string().trim().regex(/^[1-9]\d*[smhd]$/,  ...)
```

The regex permits `999999999999d` as a valid duration. Most JWT libraries silently clamp or overflow on extreme values. A practical upper bound (e.g., max 365 days) would prevent accidental misconfiguration.

**Fix:** Add a `superRefine` or `refine` on `durationSchema` that parses the numeric part and enforces a maximum (e.g., `<= 525600` for minutes-based durations), or at minimum clamp the digit count in the regex (`^[1-9]\d{0,6}[smhd]$`).

---

#### 10. `trimStringOrUndefined` returns non-string values unchanged (`string-normalization.ts:9-16`)

```ts
export function trimStringOrUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;   // numbers, booleans, objects pass through
  }
  ...
}
```

This is intentional — `z.preprocess` receives `unknown` and Zod validates the output. However, if a number like `123` is passed for `GOOGLE_CLIENT_ID`, the preprocessor passes `123` through unchanged. Zod then correctly rejects it with "expected string, received number". This behavior is correct but unintuitive and the spec at line 15 (`expect(trimStringOrUndefined(123)).toBe(123)`) documents the pass-through without commentary. A code comment explaining why non-strings are returned as-is (to let Zod produce the proper type error) would prevent future "fix" attempts that silently coerce numbers to strings.

**Fix:** Add a one-line comment in `string-normalization.ts` explaining the intentional pass-through design.

---

## Verification Pass — 2026-03-05

Checked every finding against the current state of the branch.

| #   | Finding                                           | Status                                                                                                     |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | JWT secrets not trimmed                           | ✅ Fixed — `jwtSecretSchema = z.preprocess(trimString, z.string().min(16))` at `env.schema.ts:43`          |
| 2   | Identical JWT secrets in tests                    | ✅ Fixed — distinct `VALID_ACCESS_SECRET` / `VALID_REFRESH_SECRET` constants + `createBaseConfig()` helper |
| 3   | `GOOGLE_CLIENT_SECRET` no minimum length          | ✅ Fixed — `optionalTrimmedGoogleClientSecretSchema` with `.min(10)` at `env.schema.ts:38-41`              |
| 4   | `CORS_ORIGINS` free-form string                   | ✅ Fixed — `corsOriginsSchema` with transform + two refines + `isValidCorsOrigin` at `env.schema.ts:45-75` |
| 5   | `ML_SERVICE_URL` allows HTTP in production        | ✅ Fixed — `superRefine` guard at `env.schema.ts:138-147`                                                  |
| 6   | New test formatting inconsistency                 | ✅ Fixed — test at `env.schema.spec.ts:381-387` is now properly multi-line                                 |
| 7   | `API_PORT` coverage gaps                          | ✅ Fixed — five new tests at `env.schema.spec.ts:134-182`                                                  |
| 8   | `ML_SERVICE_URL` invalid URL untested             | ✅ Fixed — test at `env.schema.spec.ts:355-363`                                                            |
| 9   | `durationSchema` accepts arbitrarily large values | ❌ Still open — regex unchanged: `^[1-9]\d*[smhd]$`                                                        |
| 10  | `trimStringOrUndefined` pass-through unexplained  | ✅ Fixed — comment added at `string-normalization.ts:11`                                                   |

---

## New Findings — 2026-03-05

**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`

### P2 — Should Fix

#### 11. `isValidCorsOrigin` — dead code on `url.pathname === ''` check (`env.schema.ts:52`)

```ts
return (
  (url.pathname === '' || url.pathname === '/') &&
  ...
);
```

In all Node.js and browser environments, `new URL('http://localhost:3000').pathname` returns `'/'`, never `''`. The URL spec always populates the pathname with at least a slash for HTTP(S) URLs. The `url.pathname === ''` branch is unreachable dead code that will never be true.

**Fix:** Remove the `url.pathname === ''` condition and keep only `url.pathname === '/'`.

---

#### 12. `corsOriginsSchema` — two `.refine()` calls share identical error messages (`env.schema.ts:64-74`)

```ts
.refine(
  (origins) => origins.length > 0 && origins.every((origin) => origin !== ''),
  { message: 'CORS_ORIGINS must be a comma-separated list of valid HTTP(S) origins' },
)
.refine((origins) => origins.every(isValidCorsOrigin), {
  message: 'CORS_ORIGINS must be a comma-separated list of valid HTTP(S) origins',
})
```

Both refines produce the same message. When validation fails, the error output cannot distinguish between "an entry is empty" and "an entry is not a valid HTTP(S) URL". This makes startup misconfiguration harder to diagnose.

**Fix:** Give each refine a distinct message — e.g.:

- First refine: `'CORS_ORIGINS must not contain empty entries'`
- Second refine: `'CORS_ORIGINS entries must be valid HTTP or HTTPS origins (no path, query, or fragment)'`

---

#### 13. First `.refine()` in `corsOriginsSchema` is redundant (`env.schema.ts:64-70`)

```ts
.refine(
  (origins) => origins.length > 0 && origins.every((origin) => origin !== ''),
  ...
)
```

`isValidCorsOrigin('')` returns `false` because `new URL('')` throws, so empty strings already fail the second refine. The first refine checks a strict subset of what the second already catches, so it only adds an early exit with an undifferentiated message (see finding #12).

**Fix:** Either remove the first refine (relying on the second) or keep it with a distinct, specific message as described in finding #12.

---

#### 14. Missing test — `CORS_ORIGINS` with a path component should be rejected (`env.schema.spec.ts`)

`isValidCorsOrigin` explicitly rejects URLs that have a non-root path (e.g., `http://localhost:3000/api`). This branch inside `isValidCorsOrigin` is exercised at runtime but has no corresponding test case in the spec file. Under the project's 100% branch coverage requirement this is a gap.

**Fix:** Add a test:

```ts
it('rejects CORS_ORIGINS values with path components', () => {
  expect(() =>
    validateEnv(
      createBaseConfig({ CORS_ORIGINS: 'http://localhost:3000/api' }),
    ),
  ).toThrow(/Invalid environment configuration: CORS_ORIGINS:/);
});
```

---

#### 15. Missing test — `CORS_ORIGINS` with empty segments (`env.schema.spec.ts`)

Values like `','`, `'http://localhost:3000,'`, or `',http://localhost:3000'` produce empty string entries after splitting. The first refine in `corsOriginsSchema` handles this, but no test exercises it.

**Fix:** Add a test:

```ts
it('rejects CORS_ORIGINS values with empty segments', () => {
  expect(() =>
    validateEnv(createBaseConfig({ CORS_ORIGINS: 'http://localhost:3000,' })),
  ).toThrow(/Invalid environment configuration: CORS_ORIGINS:/);
});
```

---

### P3 — Nice to Have

#### 16. `corsOriginsSchema` re-serializes validated origins back to `string` (`env.schema.ts:75`)

```ts
.transform((origins) => origins.join(','));
```

The pipeline splits the input into `string[]`, validates each entry, then re-joins to `string`. Downstream code that uses `CORS_ORIGINS` (e.g., the CORS middleware configuration) must split the string again. Preserving the type as `string[]` after validation would eliminate this round-trip and let the type system enforce correct usage.

This is a breaking type change on `Env['CORS_ORIGINS']` and requires updating call sites, so it warrants a deliberate decision rather than an opportunistic fix.

---

#### 17. `GOOGLE_CLIENT_SECRET` min(10) boundary is untested (`env.schema.spec.ts:304-316`)

The existing rejection test uses `'short'` (5 chars). The boundary — 9 chars (should fail) vs. 10 chars (should pass) — is not tested. For a project enforcing 100% branch coverage, testing only well-below-minimum values leaves the boundary condition unverified.

**Fix:** Add a boundary test using a 9-char value (fails) and a 10-char value (passes).

---

## Verification Pass 2 — 2026-03-05

Checked all findings from the previous round against the current branch state.

| #   | Finding                                                | Status                                                                                                                                                         |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | `durationSchema` accepts arbitrarily large values      | ✅ Fixed — `accessExpirySchema` (≤ 24h) and `refreshExpirySchema` (≤ 365d) added at `env.schema.ts:49-63`, with boundary tests at `env.schema.spec.ts:136-178` |
| 11  | `url.pathname === ''` dead code in `isValidCorsOrigin` | ✅ Fixed — only `url.pathname === '/'` remains at `env.schema.ts:98`                                                                                           |
| 12  | Identical CORS refine error messages                   | ✅ Fixed — `CORS_EMPTY_ENTRIES_MESSAGE` and `CORS_INVALID_ORIGIN_MESSAGE` constants at `env.schema.ts:14-17`                                                   |
| 13  | First `corsOriginsSchema` refine redundant             | ✅ Addressed — second refine uses `.filter(Boolean)` to avoid double-reporting; first refine now provides a distinct, specific message                         |
| 14  | Missing test: `CORS_ORIGINS` with path component       | ✅ Fixed — test at `env.schema.spec.ts:412-422`                                                                                                                |
| 15  | Missing test: `CORS_ORIGINS` with empty segments       | ✅ Fixed — test at `env.schema.spec.ts:424-434`                                                                                                                |
| 16  | `CORS_ORIGINS` re-serialized to `string`               | ✅ Fixed — `corsOriginsSchema` now returns `string[]`; `main.ts:35` already uses `get<string[]>('CORS_ORIGINS')`                                               |
| 17  | `GOOGLE_CLIENT_SECRET` min(10) boundary untested       | ✅ Fixed — boundary test at `env.schema.spec.ts:364-386` tests 9-char (fail) and 10-char (pass)                                                                |

---

## New Findings — 2026-03-05 (Pass 2)

**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`

### P2 — Should Fix

#### 18. No cross-field validation — `JWT_ACCESS_EXPIRY` can legally exceed `JWT_REFRESH_EXPIRY` (`env.schema.ts:128-129`)

```ts
JWT_ACCESS_EXPIRY: accessExpirySchema.default('15m'),   // max 24h
JWT_REFRESH_EXPIRY: refreshExpirySchema.default('7d'),  // max 365d
```

Both fields are validated independently. A configuration like `JWT_ACCESS_EXPIRY: '24h'` and `JWT_REFRESH_EXPIRY: '1h'` passes both individual bounds but produces an access token (86 400 s) that outlives the refresh token (3 600 s). When the refresh token expires the user is logged out, but any access token issued before that point remains valid for the rest of its full 24-hour window. This defeats token rotation and means a stolen access token cannot be revoked via refresh token expiry.

**Fix:** In `superRefine`, after individual fields are validated, compare `durationToSeconds(env.JWT_ACCESS_EXPIRY) < durationToSeconds(env.JWT_REFRESH_EXPIRY)` and add a custom issue on `JWT_ACCESS_EXPIRY` if the condition fails. Export or hoist `durationToSeconds` so it is accessible there.

---

#### 19. Missing tests — `CORS_ORIGINS` with query string and hash fragment (`env.schema.spec.ts`)

`isValidCorsOrigin` checks both `url.search.length === 0` and `url.hash.length === 0`. Neither branch is exercised by any test:

- Query string: `'http://localhost:3000?debug=true'` — `url.search` is `'?debug=true'` (length > 0) → should be rejected
- Hash fragment: `'http://localhost:3000#section'` — `url.hash` is `'#section'` (length > 0) → should be rejected

Under the project's 100% branch coverage requirement, both branches in `isValidCorsOrigin` are untested gaps.

**Fix:** Add two tests:

```ts
it('rejects CORS_ORIGINS values with query strings', () => {
  expect(() =>
    validateEnv(
      createBaseConfig({ CORS_ORIGINS: 'http://localhost:3000?debug=true' }),
    ),
  ).toThrow(/Invalid environment configuration: CORS_ORIGINS:/);
});

it('rejects CORS_ORIGINS values with hash fragments', () => {
  expect(() =>
    validateEnv(
      createBaseConfig({ CORS_ORIGINS: 'http://localhost:3000#section' }),
    ),
  ).toThrow(/Invalid environment configuration: CORS_ORIGINS:/);
});
```

---

### P3 — Nice to Have

#### 20. `durationToSeconds` — `if (!match) return NaN` branch is unreachable dead code (`env.schema.ts:40-42`)

```ts
function durationToSeconds(duration: string): number {
  const match = duration.match(/^([1-9]\d*)([smhd])$/);
  if (!match) {
    return Number.NaN;   // ← never reached
  }
  ...
}
```

`durationToSeconds` is only ever called from inside the `refine` callbacks of `accessExpirySchema` and `refreshExpirySchema`, both of which are chained off `durationSchema`. By the time the refine runs, the input has already passed `durationSchema`'s `.regex(/^[1-9]\d*[smhd]$/)` guard. The `match` call on L39 therefore always succeeds and `!match` is never true.

Note: the defensive `NaN` is safe in isolation — `NaN <= 86400` evaluates to `false`, so even if it were reached it would correctly reject the input. The issue is purely that it is dead code that creates a false impression of reachable error handling.

**Fix:** Either remove the `if (!match)` guard and the associated `NaN` return and replace with a non-null assertion (`match!`), or add a comment noting the invariant: `// match is always non-null here — callers run durationSchema first`.

---

#### 21. `.filter(Boolean)` in the second `corsOriginsSchema` refine has no explanatory comment (`env.schema.ts:111`)

```ts
.refine((origins) => origins.filter(Boolean).every(isValidCorsOrigin), {
  message: CORS_INVALID_ORIGIN_MESSAGE,
})
```

The `filter(Boolean)` silently skips empty strings so that only the first refine fires for empty-entry errors, preventing duplicate error messages. Without a comment, a future developer is likely to remove it as "obviously unnecessary cleanup" — which would cause both error messages to appear simultaneously when an origin list contains an empty entry.

**Fix:** Add a comment above the second refine:

```ts
// filter(Boolean) prevents double-reporting: empty entries are caught by the
// first refine above; this refine handles protocol/path/query/hash validity.
```

---

## Verification Pass 3 — 2026-03-05

| #   | Finding                                                    | Status                                                                                                          |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 18  | No cross-field validation: access expiry ≥ refresh expiry  | ✅ Fixed — `superRefine` guard at `env.schema.ts:145-153`; tests at `env.schema.spec.ts:180-203`                |
| 19  | Missing tests: CORS query string and hash fragment         | ✅ Fixed — tests at `env.schema.spec.ts:449-471`                                                                |
| 20  | `durationToSeconds` — `if (!match)` described as dead code | ✅ Addressed — comment added at `env.schema.ts:39`; see finding #25 for a correction to the original assessment |
| 21  | `.filter(Boolean)` in second CORS refine unexplained       | ✅ Fixed — comment added at `env.schema.ts:112`                                                                 |

---

## New Findings — 2026-03-05 (Pass 3)

**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`

### P2 — Should Fix

#### 22. `z.ZodIssueCode.custom` enum replaced with the string literal `'custom'` throughout `superRefine` (`env.schema.ts:149, 167, 173, 180, 192, 205, 213, 221`)

All `ctx.addIssue` calls now use `code: 'custom'` (plain string) rather than `code: z.ZodIssueCode.custom` (the typed enum). While both are equivalent at runtime — `z.ZodIssueCode.custom === 'custom'` — the string literal bypasses TypeScript's enum type-check. If Zod ever changes the value of `ZodIssueCode.custom` or if a typo is introduced (e.g., `'Custom'`), the issue will silently produce a Zod warning instead of a proper validation error, with no compile-time failure.

The original code consistently used `z.ZodIssueCode.custom`. The change to string literals is an unintentional type-safety regression.

**Fix:** Restore `code: z.ZodIssueCode.custom` across all `ctx.addIssue` calls in `superRefine`.

---

#### 23. Missing test — equal `JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY` are rejected (`env.schema.spec.ts`)

The cross-field guard uses `>=`:

```ts
if (accessExpirySeconds >= refreshExpirySeconds) {
```

The test at L180 only covers the strictly-greater case (`'24h'` vs `'1h'`). The equal case — e.g., `JWT_ACCESS_EXPIRY: '1h'` with `JWT_REFRESH_EXPIRY: '1h'` — is also rejected but untested. Under 100% branch coverage, the equality branch of `>=` is unexercised.

**Fix:** Add a test:

```ts
it('rejects JWT_ACCESS_EXPIRY values equal to JWT_REFRESH_EXPIRY', () => {
  expect(() =>
    validateEnv(
      createBaseConfig({ JWT_ACCESS_EXPIRY: '1h', JWT_REFRESH_EXPIRY: '1h' }),
    ),
  ).toThrow(
    /Invalid environment configuration: JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY/,
  );
});
```

---

#### 24. Missing tests — cross-unit duration comparison in `durationToSeconds` (`env.schema.spec.ts`)

`durationToSeconds` is called by the cross-field guard with values that may use different units. The existing tests only compare same-unit values (`'24h'` vs `'1h'`, `'1h'` vs `'2h'`). The unit-conversion logic in `durationToSeconds` is not exercised by any cross-field test. Two specific gaps:

- `JWT_ACCESS_EXPIRY: '60m'` vs `JWT_REFRESH_EXPIRY: '1h'` — equal in seconds (3600 = 3600), should be **rejected**
- `JWT_ACCESS_EXPIRY: '59m'` vs `JWT_REFRESH_EXPIRY: '1h'` — access < refresh (3540 < 3600), should be **accepted**

**Fix:** Add both cases as tests to confirm that `durationToSeconds` correctly converts across units during cross-field comparison.

---

### P3 — Nice to Have

#### 25. Correction to finding #20 — `durationToSeconds` defensive guard is not dead code (`env.schema.ts:41-43`)

Finding #20 incorrectly characterised `if (!match) { return NaN }` as dead code. It is actually necessary. Zod's `superRefine` on a `z.object()` runs after individual field schemas complete but receives the partially-parsed `data` object, which may include fields whose individual `ZodEffects` chains failed. If `JWT_ACCESS_EXPIRY` fails the regex (e.g., `'0m'`), `env.JWT_ACCESS_EXPIRY` inside `superRefine` contains `'0m'`. `durationToSeconds('0m')` finds no match and returns `NaN`. `NaN >= refreshExpirySeconds` evaluates to `false`, so no spurious cross-field error fires. Without the guard, `match[1]` would dereference `null` and throw a `TypeError` inside the refine, producing an internal Zod error instead of the expected validation message.

The comment added in pass 2 is accurate. No code change needed — this is a correction to the review record only.

---

#### 26. Missing test — non-string `CORS_ORIGINS` value (`env.schema.spec.ts`)

The `CORS_ORIGINS` preprocess calls `trimStringOrUndefined(value)`. For a non-string input (e.g., `123`), `trimStringOrUndefined` returns it unchanged. `123 ?? DEFAULT_CORS_ORIGINS_RAW` is `123` (not nullish), so `123` is passed to `corsOriginsSchema`. The `z.string()` base rejects it with "expected string, received number". This path is correct but untested — a coverage gap under the 100% threshold.

**Fix:** Add a test:

```ts
it('rejects non-string CORS_ORIGINS values', () => {
  expect(() => validateEnv(createBaseConfig({ CORS_ORIGINS: 123 }))).toThrow(
    /Invalid environment configuration: CORS_ORIGINS:/,
  );
});
```

---

## Verification Pass 4 — 2026-03-05

| #   | Finding                                              | Status                                                                                                                     |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 22  | `'custom'` string literal vs `z.ZodIssueCode.custom` | ❌ Not applicable — `ZodIssueCode` is deprecated in current Zod; `'custom'` is correct and type-checked by the issue union |
| 23  | Equal expiry case untested                           | ✅ Fixed — test at `env.schema.spec.ts:193-204`                                                                            |
| 24  | Cross-unit duration comparison untested              | ✅ Fixed — tests at `env.schema.spec.ts:206-229`                                                                           |
| 25  | Correction note on #20                               | ✅ Documentation only, no code change needed                                                                               |
| 26  | Non-string `CORS_ORIGINS` untested                   | ✅ Fixed — test at `env.schema.spec.ts:523-533`                                                                            |

---

## New Findings — 2026-03-05 (Pass 4)

**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`

### P2 — Should Fix

#### 27. `durationToSeconds` duplicates the regex from `durationSchema` — divergence risk (`env.schema.ts:25` vs `env.schema.ts:40`)

```ts
// durationSchema (L25)
/^[1-9]\d*[smhd]$/

// durationToSeconds (L40)
/^([1-9]\d*)([smhd])$/
```

The two regexes are structurally identical — differing only in capture groups. If the supported unit characters are ever extended (e.g., adding `w` for weeks), the developer must update both regexes independently. Missing one produces a silent mismatch: the schema accepts the new unit but `durationToSeconds` returns `NaN`, triggering the defensive guard and causing the cross-expiry check to silently pass for values that should be compared.

**Fix:** Extract the unit character class to a shared constant and compose both regexes from it:

```ts
const DURATION_UNITS = 'smhd' as const;
const durationRegex = new RegExp(`^[1-9]\\d*[${DURATION_UNITS}]$`);
const durationCaptureRegex = new RegExp(`^([1-9]\\d*)([${DURATION_UNITS}])$`);
```

---

#### 28. Three production Google OAuth tests implicitly allow an HTTP `ML_SERVICE_URL` default (`env.schema.spec.ts:293, 305, 319`)

The tests at L293-303, L305-317, and L319-331 all test production error reporting for missing Google OAuth credentials. None sets an explicit `ML_SERVICE_URL`, so the default `'http://localhost:5000'` is used. In `superRefine`, that default triggers the production HTTPS check and adds an `ML_SERVICE_URL` error to the thrown message — silently alongside the Google OAuth errors.

The tests pass only because `.toThrow(/regex/)` performs a substring match; the ML_SERVICE_URL error appears in the full error string but is not part of the expected regex. This means each test is unknowingly asserting against a larger error message than intended, and any change to error ordering could cause the regex match to fail for the wrong reason.

**Fix:** Add `ML_SERVICE_URL: 'https://ml.example.com'` to the three affected `createBaseConfig` calls so the tests are explicit about what they expect and isolate only the Google OAuth error behaviour.

---

#### 29. Cross-expiry error fires on `JWT_ACCESS_EXPIRY` even when that field has already failed its own max-bound validation (`env.schema.ts:147`)

```ts
if (accessExpirySeconds >= refreshExpirySeconds) {
```

When `JWT_ACCESS_EXPIRY: '25h'` (exceeds the 24h maximum) is combined with `JWT_REFRESH_EXPIRY: '1h'`, `superRefine` sees `env.JWT_ACCESS_EXPIRY = '25h'`. `durationToSeconds('25h')` = 90 000, which is ≥ `durationToSeconds('1h')` = 3 600. Both the individual max-bound error and the cross-expiry error are added to `JWT_ACCESS_EXPIRY`:

```
JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be less than or equal to 24h,
JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY
```

The second error is misleading noise — the root cause is the absolute maximum violation, not the relationship to the refresh expiry.

**Fix:** Guard the cross-expiry check with bounds pre-validation:

```ts
const accessValid = accessExpirySeconds <= ACCESS_TOKEN_MAX_DURATION_SECONDS;
const refreshValid = refreshExpirySeconds <= REFRESH_TOKEN_MAX_DURATION_SECONDS;
if (accessValid && refreshValid && accessExpirySeconds >= refreshExpirySeconds) {
```

---

### P3 — Nice to Have

#### 30. `DEFAULT_CORS_ORIGINS` array is only used to compute `DEFAULT_CORS_ORIGINS_RAW` (`env.schema.ts:8-13`)

```ts
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', ...];
const DEFAULT_CORS_ORIGINS_RAW = DEFAULT_CORS_ORIGINS.join(',');
```

`DEFAULT_CORS_ORIGINS` is never referenced directly after L13. The array exists solely to produce the raw string, adding indirection with no benefit. The parsed output of `corsOriginsSchema` is already `string[]`, so the array form of the default is available at the output level — there is no need to preserve it at the constant level.

**Fix:** Inline the join: `const DEFAULT_CORS_ORIGINS_RAW = 'http://localhost:3000,http://localhost:5173,http://localhost:8081';` and remove the intermediate array, matching the style of `DEFAULT_CORS_ORIGINS_RAW` as the single source of truth for the raw default.

---

## Verification Pass 5 — 2026-03-05

| #   | Finding                                                                   | Status                                                                                                                                           |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 27  | Duplicate regex between `durationSchema` and `durationToSeconds`          | ✅ Fixed — `DURATION_UNITS_CHARACTER_CLASS` + shared `durationRegex` / `durationCaptureRegex` at `env.schema.ts:23-31`                           |
| 28  | Production Google OAuth tests accepted HTTP ML_SERVICE_URL                | ✅ Fixed — explicit `ML_SERVICE_URL: 'https://ml.example.com'` + `.not.toContain('ML_SERVICE_URL')` assertions using `getValidationErrorMessage` |
| 29  | Cross-expiry check fires when access already fails max bound              | ✅ Fixed — `accessExpiryWithinLimit && refreshExpiryWithinLimit` guard at `env.schema.ts:152-160`, tested at `env.schema.spec.ts:157-171`        |
| 30  | `DEFAULT_CORS_ORIGINS` array — intermediate constant with no direct usage | ✅ Fixed — inlined to single `DEFAULT_CORS_ORIGINS_RAW` string at `env.schema.ts:8-9`                                                            |

---

## New Findings — 2026-03-05 (Pass 5)

**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`

### P1 — Must Fix

#### 31. `ML_SERVICE_URL` production HTTPS check is case-sensitive and bypassed by uppercase scheme (`env.schema.ts:203`)

```ts
if (env.NODE_ENV === 'production' && env.ML_SERVICE_URL.startsWith('http://')) {
```

`z.string().url()` validates using the WHATWG `URL` constructor, which normalises scheme to lowercase internally but does **not** mutate or return the normalised string — Zod stores the original input. Verified:

```
new URL('HTTP://ml.example.com').href  → 'http://ml.example.com/'  (normalised)
env.ML_SERVICE_URL                     → 'HTTP://ml.example.com'   (original)
```

`'HTTP://ml.example.com'.startsWith('http://')` is `false`. The HTTPS check never fires, and an HTTP URL is accepted in production without error. Any case variant (`HTTP://`, `Http://`, `hTtP://`) exploits this bypass.

**Fix:** Replace the `startsWith` check with a protocol comparison on the parsed URL, which is always lowercase:

```ts
if (
  env.NODE_ENV === 'production' &&
  new URL(env.ML_SERVICE_URL).protocol === 'http:'
) {
```

---

### P2 — Should Fix

#### 32. Missing test — `refreshExpiryWithinLimit = false` branch of the cross-expiry guard is untested (`env.schema.spec.ts`)

The cross-expiry guard at `env.schema.ts:156-160` has three Boolean branches:

| `accessWithinLimit` | `refreshWithinLimit` | Tested?               |
| ------------------- | -------------------- | --------------------- |
| `true`              | `true`               | ✅ (L205, L218, L231) |
| `false`             | `true`               | ✅ (L157-171)         |
| `true`              | `false`              | ❌                    |

The `true && false` path — where `JWT_REFRESH_EXPIRY` exceeds 365d but `JWT_ACCESS_EXPIRY` is valid — is never exercised. Under 100% branch coverage this is a gap.

**Fix:** Add a test:

```ts
it('does not add cross-expiry errors when refresh expiry already fails max bound validation', () => {
  const message = getValidationErrorMessage(
    createBaseConfig({
      JWT_ACCESS_EXPIRY: '24h',
      JWT_REFRESH_EXPIRY: '366d',
    }),
  );

  expect(message).toContain(
    'JWT_REFRESH_EXPIRY: JWT_REFRESH_EXPIRY must be less than or equal to 365d',
  );
  expect(message).not.toContain(
    'JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY',
  );
});
```

---

#### 33. `getValidationErrorMessage` helper uses an unsafe `as Error` cast (`env.schema.spec.ts:27`)

```ts
return (error as Error).message;
```

If `validateEnv` ever throws a non-`Error` value (string, plain object), `.message` would be `undefined`, causing tests that use `getValidationErrorMessage` to pass silently on wrong input rather than failing loudly. The helper should narrow the type:

```ts
if (error instanceof Error) return error.message;
throw new Error(`validateEnv threw a non-Error: ${String(error)}`);
```

---

#### 34. `GOOGLE_CLIENT_ID` has no minimum length — asymmetric with `GOOGLE_CLIENT_SECRET` (`env.schema.ts:137`)

```ts
GOOGLE_CLIENT_ID: optionalTrimmedStringSchema,         // z.string().optional() — no min
GOOGLE_CLIENT_SECRET: optionalTrimmedGoogleClientSecretSchema, // z.string().min(10).optional()
```

`GOOGLE_CLIENT_ID` accepts any non-empty string including `'a'`. Real Google OAuth client IDs are at minimum ~32 characters. The asymmetry with `GOOGLE_CLIENT_SECRET`'s `min(10)` guard is unexplained and means obvious copy-paste errors (e.g., setting `GOOGLE_CLIENT_ID` to a placeholder `'x'`) pass silently.

**Fix:** Apply at minimum `z.string().min(10).optional()` to `GOOGLE_CLIENT_ID`, matching the floor applied to the secret.

---

#### 35. Missing test — `ML_SERVICE_URL` with uppercase scheme bypasses production HTTPS check (`env.schema.spec.ts`)

Directly exercises the security bypass identified in finding #31. No test currently passes `ML_SERVICE_URL: 'HTTP://ml.example.com'` in a production config and asserts the error fires.

**Fix:** Add a test:

```ts
it('rejects uppercase-scheme ML_SERVICE_URL values in production', () => {
  expect(() =>
    validateEnv(
      createBaseConfig({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        ML_SERVICE_URL: 'HTTP://ml.internal:5000',
      }),
    ),
  ).toThrow(
    /Invalid environment configuration: ML_SERVICE_URL: ML_SERVICE_URL must use https when NODE_ENV=production/,
  );
});
```

---

#### 36. Missing test — `NODE_ENV: 'test'` is accepted but its validation behaviour is unverified (`env.schema.spec.ts`)

```ts
NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
```

`'test'` is a valid `NODE_ENV` but there is no test that uses it. The `superRefine` block treats `'test'` as non-production: Google OAuth partial config is checked, ML HTTPS check is skipped. Whether this is intentional for CI environments is undocumented and untested. If a test CI pipeline sets `NODE_ENV=test` with a partial Google OAuth config, startup would be rejected at runtime.

**Fix:** Add at minimum one test asserting that `NODE_ENV: 'test'` is accepted with the base config, and one confirming whether partial Google OAuth triggers an error in test mode.

---

### P3 — Nice to Have

#### 37. Three `it` blocks contain multiple independent assertions — single failure silences the second (`env.schema.spec.ts:123, 428, 464`)

- L123: `rejects non-positive JWT duration values` — asserts both `'0m'` and `'0d'`
- L428: `rejects non-string Google OAuth values` — asserts both `GOOGLE_CLIENT_ID: 123` and `GOOGLE_CALLBACK_URL: 123`
- L464: `enforces GOOGLE_CLIENT_SECRET length boundary` — asserts both 9-char rejection and 10-char acceptance

In Jest, if the first `expect` in a test throws, subsequent `expect` calls in the same `it` never run. Under strict 100% coverage, each independent scenario should be its own `it` block.

**Fix:** Split each multi-assertion `it` into two separate tests.

---

#### 38. `DURATION_UNITS_CHARACTER_CLASS` is built from `Object.keys()` with no escaping for regex special characters (`env.schema.ts:23-25`)

```ts
const DURATION_UNITS_CHARACTER_CLASS = Object.keys(durationUnitInSeconds).join(
  '',
);
// → 'smhd'  (safe today)
```

`Object.keys()` produces keys in insertion order. If a future contributor adds a unit whose key contains a regex metacharacter (e.g., `'-'`, `'.'`, `'^'`, `']'`), the dynamically-built character class `[smhd-]` would silently produce a range or malformed regex. There is no guard or documentation of the single-lowercase-letter invariant.

**Fix:** Add a startup assertion or type constraint ensuring every key is a single alphabetic character, or escape each character when building the class string.

---

#### 39. `type DurationUnit` is declared at `env.schema.ts:41`, interleaved between `durationSchema` (L33) and `durationToSeconds` (L43)

```ts
const durationSchema = z.string()...   // L33
                                        // ...
type DurationUnit = keyof typeof ...    // L41  ← type declaration mid-schema
function durationToSeconds(...) { ... } // L43
```

Types are generally grouped at the top of a module or near the constants they derive from. Placing `DurationUnit` between two runtime declarations makes the file harder to scan. Moving it to immediately after `durationUnitInSeconds` (L21) would keep type and value together.

---

#### 40. `isValidCorsOrigin` and `durationToSeconds` are module-private — only indirectly testable (`env.schema.ts`)

Both functions contain branching logic that is exercised only via integration through `validateEnv`. A bug in `durationToSeconds`'s unit multiplication (e.g., wrong multiplier for `h`) would produce a misleading error like "must be shorter than JWT_REFRESH_EXPIRY" rather than a precise unit-conversion failure. Exporting these functions (even with an `/* @internal */` comment) would allow direct unit tests that isolate the conversion logic from the Zod machinery.

---

#### 41. `API_PREFIX` default `'api/v1'` has no leading slash; user-supplied values preserve their slash (`env.schema.ts:130`)

```ts
API_PREFIX: z.preprocess(trimStringOrUndefined, z.string().default('api/v1')),
```

A user supplying `API_PREFIX: '/api/v2'` gets `/api/v2` (with slash). The default `'api/v1'` has no slash. The inconsistency is masked by `normalizeApiPrefix` in `main.ts`, but a consumer reading `env.API_PREFIX` directly (e.g., in tests or other modules) may encounter an inconsistently formatted value without realising normalization is required.

**Fix:** Either normalise in the schema (strip or enforce a leading slash) or document the invariant that `API_PREFIX` requires downstream normalisation.

---

#### 42. Test at L33 (`parses valid config and applies defaults`) does not assert the `CORS_ORIGINS` default (`env.schema.spec.ts:33-41`)

```ts
it('parses valid config and applies defaults', () => {
  expect(parsed.NODE_ENV).toBe('development');
  expect(parsed.API_PORT).toBe(3000);
  expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
  expect(parsed.JWT_REFRESH_EXPIRY).toBe('7d');
  expect(parsed.ML_SERVICE_URL).toBe('http://localhost:5000');
  // CORS_ORIGINS and API_PREFIX are not verified
});
```

`CORS_ORIGINS` is the most structurally complex field (it went through `corsOriginsSchema`) and `API_PREFIX` also has a default. Neither is verified in the canonical "defaults" test, so a regression to those defaults would only be caught by the more targeted tests at L59-73.

**Fix:** Add `expect(parsed.CORS_ORIGINS).toEqual([...])` and `expect(parsed.API_PREFIX).toBe('api/v1')` to the defaults test.

---

## Verification Pass 6 — 2026-03-05

**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`, `apps/api/src/common/utils/api-prefix.ts`

| #   | Finding                                                                               | Status   | Notes                                                                                                                               |
| --- | ------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 31  | ML_SERVICE_URL case-sensitive HTTPS bypass                                            | ✅ Fixed | Now uses `new URL(env.ML_SERVICE_URL).protocol === 'http:'`                                                                         |
| 32  | Missing test — `refreshExpiryWithinLimit = false` branch                              | ✅ Fixed | `spec.ts:224–238` covers `JWT_REFRESH_EXPIRY: '366d'` with guard suppression assertion                                              |
| 33  | `getValidationErrorMessage` unsafe `as Error` cast                                    | ✅ Fixed | Replaced with `instanceof Error` guard + `getValidationErrorMessageFrom` abstraction; non-Error path tested at `spec.ts:63–69`      |
| 34  | `GOOGLE_CLIENT_ID` has no minimum length                                              | ✅ Fixed | `optionalTrimmedGoogleClientIdSchema` now uses `z.string().min(10).optional()`                                                      |
| 35  | Missing test — uppercase ML_SERVICE_URL scheme in production                          | ✅ Fixed | `spec.ts:747–761` tests `'HTTP://ml.internal:5000'`                                                                                 |
| 36  | Missing test — `NODE_ENV: 'test'` behaviour unverified                                | ✅ Fixed | `spec.ts:437–445` accepts test mode; `spec.ts:447–458` verifies partial Google OAuth is rejected in test mode                       |
| 37  | Multi-assertion `it` blocks at L123, L428, L464                                       | ✅ Fixed | All three blocks split into individual tests                                                                                        |
| 38  | `DURATION_UNITS_CHARACTER_CLASS` built via `Object.keys()` without escaping           | ✅ Fixed | Replaced with `DURATION_UNITS.join('')` from typed `as const` array; character class no longer constructed from runtime object keys |
| 39  | `type DurationUnit` declared mid-module, interleaved between constants                | ✅ Fixed | `DurationUnit` now declared at `schema.ts:18`, immediately after `DURATION_UNITS` constant                                          |
| 40  | `isValidCorsOrigin` and `durationToSeconds` are module-private                        | ✅ Fixed | Both functions are now exported; direct unit tests added at `spec.ts:71–90`                                                         |
| 41  | `API_PREFIX` not normalized in schema — requires downstream `normalizeApiPrefix` call | ✅ Fixed | `API_PREFIX` transform now calls `normalizeApiPrefix(value)` via imported function                                                  |
| 42  | Defaults test does not assert `CORS_ORIGINS` or `API_PREFIX`                          | ✅ Fixed | `spec.ts:52–60` now asserts both `API_PREFIX: 'api/v1'` and the full `CORS_ORIGINS` array                                           |

---

### New Findings — 2026-03-05

#### 43. `normalizeApiPrefix` is called twice — once in the schema, once in `main.ts` (`main.ts:32`, `env.schema.ts:133`) **[P2]**

```ts
// env.schema.ts:128–134 (schema transform — new)
API_PREFIX: z.preprocess(
  trimStringOrUndefined,
  z.string().default('api/v1').transform((value) => normalizeApiPrefix(value)),
),

// main.ts:32 (existing call — now redundant)
const prefix = normalizeApiPrefix(configService.get<string>('API_PREFIX'));
```

After the schema fix, `configService.get<string>('API_PREFIX')` returns a fully normalized string (leading/trailing slashes stripped, blank-string fallback applied). Passing it to `normalizeApiPrefix` again is a no-op because `normalizeApiPrefix` is idempotent — but it signals to readers that the value might still be un-normalized at the point of consumption. It also means `normalizeApiPrefix` is imported in two separate locations, and any behavioral change to it affects both call sites.

**Fix:** Remove the redundant call in `main.ts`:

```ts
// Before
const prefix = normalizeApiPrefix(configService.get<string>('API_PREFIX'));

// After
const prefix = configService.get<string>('API_PREFIX') ?? DEFAULT_API_PREFIX;
// or simply
const prefix = configService.getOrThrow<string>('API_PREFIX');
```

---

#### 44. New direct-unit tests reintroduce the multi-assertion pattern fixed in #37 (`env.schema.spec.ts:71–90`) **[P2]**

```ts
it('converts duration strings to seconds', () => {
  expect(durationToSeconds('30s')).toBe(30);
  expect(durationToSeconds('15m')).toBe(900);
  expect(durationToSeconds('2h')).toBe(7200); // ← 3 independent expects
  expect(durationToSeconds('3d')).toBe(259200); // ← silenced if '2h' fails
});

it('returns NaN for unsupported duration strings', () => {
  expect(Number.isNaN(durationToSeconds('0m'))).toBe(true);
  expect(Number.isNaN(durationToSeconds('abc'))).toBe(true); // silenced if '0m' fails
});

it('validates CORS origins directly', () => {
  expect(isValidCorsOrigin('https://app.example.com')).toBe(true);
  expect(isValidCorsOrigin('http://localhost:3000')).toBe(true);
  expect(isValidCorsOrigin('ftp://app.example.com')).toBe(false);
  expect(isValidCorsOrigin('https://app.example.com/path')).toBe(false);
  expect(isValidCorsOrigin('https://app.example.com?x=1')).toBe(false); // ← silenced if earlier fails
  expect(isValidCorsOrigin('https://app.example.com#hash')).toBe(false);
});
```

These tests were added as part of fixing #40 (exporting the functions for direct testing) but repeat the same pattern that #37 identified as a defect. If `durationToSeconds('2h')` returns the wrong value, the `'3d'` case never runs and the failure report understates the scope of the bug.

**Fix:** Split each `it` into one assertion per block.

---

#### 45. Missing test — `isValidCorsOrigin('')` (empty string) (`env.schema.spec.ts:83–90`) **[P3]**

`isValidCorsOrigin('')` calls `new URL('')`, which throws a `TypeError`. The function catches it and returns `false`. The empty-string path exercises the `catch` branch but no test covers it:

```ts
// spec.ts:83-90 — tests protocol, path, query, hash; not empty input
expect(isValidCorsOrigin('ftp://app.example.com')).toBe(false); // protocol
expect(isValidCorsOrigin('https://app.example.com/path')).toBe(false); // path
// ← isValidCorsOrigin('') is not tested
```

Under 100% branch coverage, the `catch` path must be explicitly covered with a value that actually triggers the `URL` constructor's `TypeError`.

**Fix:** Add `expect(isValidCorsOrigin('')).toBe(false)` to the direct unit test (as a separate `it` if #44 is also fixed).

---

#### 46. Missing test — invalid `NODE_ENV` values are silently untested (`env.schema.spec.ts`) **[P3]**

```ts
NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
```

The schema rejects any value outside the three allowed literals. No test asserts that an invalid value (e.g., `'staging'`, `'prod'`, `1`) is actually rejected with an appropriate message. The enum rejection path is untested.

**Fix:** Add a test:

```ts
it('rejects unknown NODE_ENV values', () => {
  expect(() => validateEnv(createBaseConfig({ NODE_ENV: 'staging' }))).toThrow(
    /Invalid environment configuration: NODE_ENV:/,
  );
});
```

---

#### 47. `Number.isNaN(...).toBe(true)` used instead of Jest's `toBeNaN()` matcher (`env.schema.spec.ts:79–80`) **[P3]**

```ts
expect(Number.isNaN(durationToSeconds('0m'))).toBe(true);
expect(Number.isNaN(durationToSeconds('abc'))).toBe(true);
```

Jest provides a purpose-built `toBeNaN()` matcher that produces a more informative failure message. When `durationToSeconds('0m')` returns `0` instead of `NaN`, the current failure reads:

```
Expected: true
Received: false
```

With `toBeNaN()` it reads:

```
Expected NaN, received: 0
```

**Fix:** Replace with `expect(durationToSeconds('0m')).toBeNaN()`.

---

#### 48. No acceptance test for HTTP `ML_SERVICE_URL` in development or test mode (`env.schema.spec.ts`) **[P3]**

The HTTPS enforcement is production-only. The non-production path — where an HTTP URL should be accepted — is exercised implicitly via the base config default (`http://localhost:5000`) but is never explicitly asserted as intentional:

```ts
// Implicit: every development test uses the http:// default
// Explicit: nothing documents "http:// is OK in dev"
```

Without an explicit test, a future refactor that accidentally enforces HTTPS in all environments would not fail any test that clearly names the non-enforcement intent.

**Fix:** Add:

```ts
it('accepts http ML_SERVICE_URL in development mode', () => {
  const parsed = validateEnv(
    createBaseConfig({ ML_SERVICE_URL: 'http://ml.internal:5000' }),
  );
  expect(parsed.ML_SERVICE_URL).toBe('http://ml.internal:5000');
});
```

---

#### 49. `API_PREFIX` slash-only input fallback path is untested (`env.schema.spec.ts`) **[P3]**

`normalizeApiPrefix('///')` strips all leading/trailing slashes, producing `''`, and falls back to `DEFAULT_API_PREFIX` (`'api/v1'`). The existing blank-string fallback test at `spec.ts:108–122` covers `API_PREFIX: '   '` (whitespace-only) but not a slash-only value like `'///'` that takes a different code path through `normalizePrefixValue`:

```ts
function normalizePrefixValue(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, ''); // trims, then strips slashes
}
// '///' → '' → falls through to fallback
// '   ' → '' via trimStringOrUndefined → undefined → .default() → 'api/v1'
```

Both end at the same output but through different logic. The `normalizePrefixValue`-based path is untested.

**Fix:** Add a test:

```ts
it('falls back to default when API_PREFIX is slash-only', () => {
  const parsed = validateEnv(createBaseConfig({ API_PREFIX: '///' }));
  expect(parsed.API_PREFIX).toBe('api/v1');
});
```

---

#### 50. `normalizeApiPrefix` import introduces cross-module coupling into the previously self-contained schema (`env.schema.ts:3`) **[P3]**

```ts
import { normalizeApiPrefix } from '../common/utils/api-prefix';
```

Before this change, `env.schema.ts` had zero internal project imports — only the external `zod` dependency. This made the module trivially testable and portable. The import creates a hard dependency:

- If `normalizeApiPrefix` is moved, renamed, or changes signature, the schema breaks.
- Unit-testing `env.schema.ts` in isolation now requires `api-prefix.ts` to be resolvable.
- The schema module now carries implicit knowledge of the API prefix normalisation rules (e.g., "strip slashes, fall back to `api/v1`") even though `env.schema.ts` is not the natural home for that logic.

This is not a defect — the coupling is intentional — but it warrants a comment or a boundary test to document why normalisation lives in the schema rather than exclusively at the consumer (`main.ts`).

---

#### 51. `durationToSeconds` multi-digit amounts are not directly tested (`env.schema.spec.ts:71–76`) **[P3]**

```ts
expect(durationToSeconds('30s')).toBe(30); // 2-digit
expect(durationToSeconds('15m')).toBe(900); // 2-digit
expect(durationToSeconds('2h')).toBe(7200); // 1-digit
expect(durationToSeconds('3d')).toBe(259200); // 1-digit
```

The regex `^[1-9]\d*` is designed to accept arbitrarily large amounts (e.g., `120m`, `1000s`, `365d`). No test exercises an amount with three or more digits. A calculation bug in `Number(match[1])` for large values (e.g., BigInt boundary) or a typo in the multiplier table would not be caught.

**Fix:** Add a test for a three-digit amount, e.g.:

```ts
expect(durationToSeconds('120m')).toBe(7200);
expect(durationToSeconds('365d')).toBe(31536000);
```

---

#### 52. `isValidCorsOrigin` with a non-standard port is not tested (`env.schema.spec.ts:83–90`) **[P3]**

Origins with non-standard ports (e.g., `http://localhost:8080`, `https://staging.example.com:8443`) are a common production pattern. The direct unit tests only cover the base hostname form:

```ts
expect(isValidCorsOrigin('https://app.example.com')).toBe(true);
expect(isValidCorsOrigin('http://localhost:3000')).toBe(true);
```

`http://localhost:3000` technically includes a port, but there is no test for a custom port on an HTTPS origin or a high-numbered port (`https://app.example.com:8443`). If `isValidCorsOrigin` ever grew port-specific logic, no existing test would catch a regression.

**Fix:** Add:

```ts
expect(isValidCorsOrigin('https://app.example.com:8443')).toBe(true);
expect(isValidCorsOrigin('http://localhost:8080')).toBe(true);
```

---

## Verification Pass 7 — 2026-03-05

**Scope:** `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.schema.spec.ts`, `apps/api/src/main.ts`

| #   | Finding                                                     | Status   | Notes                                                                                                                      |
| --- | ----------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 43  | `normalizeApiPrefix` called twice — redundant in `main.ts`  | ✅ Fixed | `main.ts:31` now uses `configService.getOrThrow<string>('API_PREFIX')`; `normalizeApiPrefix` import removed from `main.ts` |
| 44  | New direct-unit tests reintroduce multi-assertion pattern   | ✅ Fixed | `durationToSeconds` and `isValidCorsOrigin` each split into individual `it` blocks (L71–133)                               |
| 45  | Missing `isValidCorsOrigin('')` test                        | ✅ Fixed | `spec.ts:131–133` — `it('rejects empty CORS origins', ...)`                                                                |
| 46  | Missing `NODE_ENV` enum rejection test                      | ✅ Fixed | `spec.ts:500–508` — `it('rejects unknown NODE_ENV values', ...)` using `'staging'`                                         |
| 47  | `Number.isNaN(x).toBe(true)` instead of `.toBeNaN()`        | ✅ Fixed | `spec.ts:92, 96` use `.toBeNaN()`                                                                                          |
| 48  | No acceptance test for HTTP `ML_SERVICE_URL` in development | ✅ Fixed | `spec.ts:794–803` — explicit development HTTP acceptance test                                                              |
| 49  | `API_PREFIX` slash-only fallback path untested              | ✅ Fixed | `spec.ts:167–175` — `API_PREFIX: '///'` triggers `normalizeApiPrefix` fallback                                             |
| 50  | `normalizeApiPrefix` coupling not documented                | ✅ Fixed | `env.schema.ts:128` comment: `// Normalize once at env boundary so all consumers get a canonical prefix.`                  |
| 51  | `durationToSeconds` multi-digit amounts untested            | ✅ Fixed | `spec.ts:87–89` — `it('converts multi-digit duration strings to seconds', ...)` tests `120m`                               |
| 52  | `isValidCorsOrigin` with non-standard port untested         | ✅ Fixed | `spec.ts:107–113` — HTTPS port 8443 and HTTP port 8080 tested                                                              |

---

### New Findings — 2026-03-05

#### 53. `GOOGLE_CALLBACK_URL` accepts HTTP in production — no HTTPS enforcement (`env.schema.ts:85–88, 196–201`) **[P2]**

```ts
const optionalTrimmedUrlSchema = z.preprocess(
  trimStringOrUndefined,
  z.string().url().optional(), // ← any URL scheme accepted
);
```

In `superRefine`, the production Google OAuth check only verifies **presence**, not protocol:

```ts
if (!hasGoogleCallbackUrl) {
  ctx.addIssue({ ..., message: 'GOOGLE_CALLBACK_URL is required when NODE_ENV=production' });
}
// ← No check that the callback URL uses HTTPS
```

A production deployment with `GOOGLE_CALLBACK_URL: 'http://evil.com/callback'` passes all validation. Google itself rejects non-HTTPS redirect URIs for production OAuth apps, so this would fail at runtime rather than at startup.

**Fix:** Add a superRefine check for production:

```ts
if (
  env.NODE_ENV === 'production' &&
  env.GOOGLE_CALLBACK_URL &&
  new URL(env.GOOGLE_CALLBACK_URL).protocol === 'http:'
) {
  ctx.addIssue({
    code: 'custom',
    path: ['GOOGLE_CALLBACK_URL'],
    message: 'GOOGLE_CALLBACK_URL must use https when NODE_ENV=production',
  });
}
```

---

#### 54. `API_PORT` accepts invalid TCP port values above 65535 (`env.schema.ts:127`) **[P2]**

```ts
API_PORT: z.coerce.number().int().positive().default(3000),
```

The schema enforces `> 0` and integer, but TCP port numbers are bounded at 65535. `API_PORT: 99999` passes validation and is written to `configService`, but `app.listen(99999)` either throws an OS-level error or silently fails, depending on the platform, rather than producing a structured startup message.

**Fix:** Add `.max(65535)`:

```ts
API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
```

---

#### 55. Multi-assertion pattern persists in three integration tests (`env.schema.spec.ts:47, 438, 566`) **[P2]**

Three `it` blocks still contain multiple independent `expect` calls — a continuation of the pattern addressed in findings #37 and #44:

| Location | Test name                                             | # of `expect` calls |
| -------- | ----------------------------------------------------- | ------------------- |
| L47–61   | `parses valid config and applies defaults`            | 7                   |
| L438–456 | `requires complete Google OAuth config in production` | 4                   |
| L566–579 | `treats blank Google OAuth values as missing`         | 3                   |

The `L438–456` case is the most consequential: it asserts three distinct error messages (one per missing Google field) plus one `not.toContain`. If the first `toContain` fails, the others are silenced, masking a scenario where all three fields are absent from the error message.

**Fix:** Split each into individual `it` blocks. For `L438–456` specifically:

```ts
it('reports GOOGLE_CLIENT_ID error when no Google config is present in production', () => { ... });
it('reports GOOGLE_CLIENT_SECRET error when no Google config is present in production', () => { ... });
it('reports GOOGLE_CALLBACK_URL error when no Google config is present in production', () => { ... });
it('does not report ML_SERVICE_URL error when Google config is missing in production', () => { ... });
```

---

#### 56. `configService.get<string[]>('CORS_ORIGINS') ?? []` fallback is unreachable dead code (`main.ts:34`) **[P3]**

```ts
const allowedOrigins = configService.get<string[]>('CORS_ORIGINS') ?? [];
```

`CORS_ORIGINS` has a default value in `envSchema` and is validated at startup by `validateEnv`. If `CORS_ORIGINS` were absent or invalid, `validateEnv` would throw and `bootstrap()` would never reach this line. `configService.get()` for this key will therefore never return `undefined` in practice, and the `?? []` fallback is dead code that could mislead a reader into thinking the empty-array case is reachable.

**Fix:** Use `configService.getOrThrow<string[]>('CORS_ORIGINS')` to match the intent and mirror the `API_PREFIX` call on the previous line:

```ts
const allowedOrigins = configService.getOrThrow<string[]>('CORS_ORIGINS');
```

---

#### 57. No test for entirely absent required fields — only short/invalid values are tested (`env.schema.spec.ts`) **[P3]**

Every test for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` provides a value (either valid or `'short'`). No test omits these keys entirely to verify the error when a required field is missing from the environment:

```ts
// Existing: tests short values
validateEnv({
  DATABASE_URL: 'not-a-url',
  JWT_ACCESS_SECRET: 'short',
  JWT_REFRESH_SECRET: 'short',
});

// Missing: tests completely absent fields
validateEnv({ DATABASE_URL: VALID_DATABASE_URL });
// Expected error: "JWT_ACCESS_SECRET: ..., JWT_REFRESH_SECRET: ..."
```

Under 100% branch coverage, the `required` branch (undefined input to `z.string()`) is exercised only indirectly through the `not-a-url` multi-error test which happens to omit the secrets. A dedicated test makes the intent explicit.

**Fix:** Add:

```ts
it('rejects config with missing JWT secrets', () => {
  expect(() => validateEnv({ DATABASE_URL: VALID_DATABASE_URL })).toThrow(
    /Invalid environment configuration: JWT_ACCESS_SECRET:.*JWT_REFRESH_SECRET:/,
  );
});
```

---

#### 58. `NODE_ENV: 'development'` is redundant in the HTTP ML_SERVICE_URL acceptance test (`env.schema.spec.ts:797`) **[P3]**

```ts
it('accepts explicit http ML_SERVICE_URL values in development mode', () => {
  const parsed = validateEnv(
    createBaseConfig({
      NODE_ENV: 'development',   // ← redundant: createBaseConfig defaults to development
      ML_SERVICE_URL: 'http://ml.internal:5000',
    }),
  );
```

`createBaseConfig` does not set `NODE_ENV`, so the schema applies the `.default('development')`. The explicit `NODE_ENV: 'development'` override is a no-op and could mislead readers into thinking this is a meaningful distinction from the base config.

**Fix:** Remove the redundant override, or rename the test to `'accepts http ML_SERVICE_URL values outside production'` and use `NODE_ENV: 'test'` to intentionally vary the environment.

---

#### 59. `CORS_ORIGINS: null` silently falls back to the default instead of rejecting (`env.schema.ts:148–151`) **[P3]**

```ts
CORS_ORIGINS: z.preprocess((value) => {
  const normalized = trimStringOrUndefined(value);
  return normalized ?? DEFAULT_CORS_ORIGINS_RAW;
}, corsOriginsSchema),
```

`trimStringOrUndefined(null)` returns `null` (non-string passthrough). `null ?? DEFAULT_CORS_ORIGINS_RAW` evaluates to `DEFAULT_CORS_ORIGINS_RAW` (null is nullish). So `CORS_ORIGINS: null` silently uses the default, while `CORS_ORIGINS: 123` (non-nullish non-string) is rejected with a type error. The inconsistency is untested and undocumented.

Compare with `ML_SERVICE_URL`:

```ts
ML_SERVICE_URL: z.preprocess(
  trimStringOrUndefined,   // null → null → z.string().url() rejects null
  z.string().url().default('http://localhost:5000'),
),
```

`ML_SERVICE_URL: null` would be rejected, while `CORS_ORIGINS: null` falls back to default. This asymmetry may be intentional but is undocumented.

**Fix:** Add a test documenting the behavior:

```ts
it('falls back to default CORS_ORIGINS when null is provided', () => {
  const parsed = validateEnv(createBaseConfig({ CORS_ORIGINS: null }));
  expect(parsed.CORS_ORIGINS).toEqual([...]);
});
```

---

#### 60. `durationToSeconds` minimum (`1s`) and max-boundary (`365d`) values not covered by direct unit tests (`env.schema.spec.ts:71–89`) **[P3]**

The direct unit tests cover `30s`, `15m`, `2h`, `3d`, and `120m`. Two boundary cases are missing:

- **`'1s'`** — the minimum valid duration (the regex requires `[1-9]`, so `1s` is the smallest allowed value). `durationToSeconds('1s')` should return `1`.
- **`'365d'`** — the refresh token max boundary. This is the exact value accepted by `refreshExpirySchema`. `durationToSeconds('365d')` should return `31536000` (`365 * 24 * 60 * 60`).

Testing boundary values directly ensures the multiplier table is correct at the limits used by the schema constraints.

**Fix:** Add to the direct unit test suite:

```ts
it('converts minimum valid duration to seconds', () => {
  expect(durationToSeconds('1s')).toBe(1);
});

it('converts refresh token max boundary to seconds', () => {
  expect(durationToSeconds('365d')).toBe(31536000);
});
```

---

#### 61. `durationToSeconds` defensive comment conflates `.refine()` and `superRefine` behaviour (`env.schema.ts:44`) **[P3]**

```ts
export function durationToSeconds(duration: string): number {
  // Defensive guard: Zod may still execute refine callbacks after regex failure.
  const match = duration.match(durationCaptureRegex);
```

The comment refers to `.refine()` callbacks on `durationSchema` — Zod runs all refinements in a chain regardless of whether earlier refinements passed. This is correct.

However, `durationToSeconds` is also called from the object-level `superRefine`. Object `superRefine` is **not** called when any field fails its individual schema, so the guard is not needed to protect against `superRefine` receiving a failed value. A reader familiar only with object-level `superRefine` would find the comment confusing, and a reader familiar with only `.refine()` chains would understand it correctly.

**Fix:** Tighten the comment to specify the context:

```ts
// Defensive guard: durationSchema.refine() runs even when the preceding
// .regex() check fails, so this function may receive a non-matching string.
```
