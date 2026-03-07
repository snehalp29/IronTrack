# Code Review — E2E Tests & Test Helpers

Scope: `apps/api/test/*.e2e-spec.ts`, `apps/web/e2e/**/*.spec.ts`, `apps/web/e2e/support/api.ts`, and `apps/web/playwright.config.ts`.

Status: `0 open`

Fixed:

- `#E2E-1–#E2E-3` and `#E2E-11`: Playwright mock API now matches the real contracts for paginated workout templates, `IN_PROGRESS` session status, local-date checklist requests, and `DELETE /users/me`.
- `#E2E-4–#E2E-10`: API e2e coverage now includes select-aware Prisma mocks, refresh-token rotation reuse rejection, account deletion, unauthenticated protected-route rejection, checklist fetch/upsert/future guards, session set validation endpoints, and the broader sessions routing surface.
- `#E2E-14–#E2E-17`: Playwright now always starts an isolated server, the auth e2e app boots once per file with per-test state reset, checklist e2e mocks are recreated per test, and unhandled web mock routes emit an explicit error signal.

Closed as non-defects:

- `#E2E-12`: covered by the new protected-route 401 regression in `auth.e2e-spec.ts`; it did not need a duplicate assertion in `public.e2e-spec.ts`.
- `#E2E-13`: multi-browser expansion is an enhancement, not a correctness defect, and the local Playwright toolchain in this environment currently has Chromium only.

Outcomes:

- Browser mocks now fail loudly when frontend/API contracts drift.
- API auth/checklist/session e2e coverage now exercises the previously untested high-risk paths.
- A real route-order bug in `SessionsController` was caught and fixed while expanding the sessions e2e surface.

Validation:

- `pnpm --filter @irontrack/api test:e2e`
- `pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts`
- `pnpm --filter @irontrack/web test`
