# Code Review — E2E Tests & Test Helpers

Scope: `apps/api/test/*.e2e-spec.ts`, `apps/web/e2e/**/*.spec.ts`, `apps/web/e2e/support/api.ts`, and `apps/web/playwright.config.ts`.

Status: `0 open`

Fixed: `#E2E-1–#E2E-11` aligned Playwright mocks with paginated templates, `IN_PROGRESS` sessions, local-date checklist requests, `DELETE /users/me`, refresh-token rotation, account deletion, unauthenticated protected-route rejection, checklist future guards, and broader sessions routing; `#E2E-14–#E2E-17` made Playwright server startup isolated, auth/checklist state reset deterministic, and missing web mock routes fail loudly.

Non-defects: `#E2E-12` was already covered by the protected-route 401 regression in `auth.e2e-spec.ts`; `#E2E-13` is an enhancement because the local Playwright toolchain here exposes Chromium only.

Outcomes: browser mocks now fail loudly on contract drift, API auth/checklist/session e2e coverage exercises the previously untested high-risk paths, and the sessions route-order bug was caught and fixed while expanding the suite.

Validation: `pnpm --filter @irontrack/api test:e2e`, `pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts`, and `pnpm --filter @irontrack/web test`.
