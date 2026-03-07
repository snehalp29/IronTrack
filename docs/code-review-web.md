# Code Review — Web Frontend

Scope: `apps/web/src/api`, auth/session helpers, active-workout store/hooks, app/layout routing, reviewed pages, workout components, related unit specs, and Playwright flows.

Status: `89 total` | `89 fixed` | `0 open`

Fixed:

- `W1–W31`: auth session persistence, bearer-token injection, 401 recovery, protected routes, real login/register/Google flows, client validation, and loading/error handling.
- `W32–W67`: runtime API response validation, refresh/cookie hardening, active-session wiring, rest timer hardening, API-backed dashboard/history/settings/completion/exercise flows, mutation error handling, timezone/streak/history fixes, and modal focus handling.
- `W68–W89`: step-based exercise wizard, real exercise detail/history rendering, active-session cache sync, swap failure handling, paginated exercise loading, timezone fallback/caching, aligned template query keys, completion-summary guard, API-backed template builder, and unsaved-settings navigation protection.

Outcomes:

- Auth/session and active-workout flows are heavily covered in unit tests and Playwright, including restore/failure, notes saving, superset application, and mutation error handling.
- Exercise creation and template creation are real API-backed flows rather than scaffold placeholders.
- Date/time handling is safer and more consistent, and the tracked web backlog is closed.

Validation:

- `pnpm --filter @irontrack/web test`, `pnpm --filter @irontrack/web typecheck`, `pnpm --filter @irontrack/web exec playwright test --config ./playwright.config.ts`, `pnpm lint:code`, and `pnpm format:check`.
