# Code Review — Infrastructure & Cross-Cutting

Scope: `app.module.ts`, `main.ts`, auth guards/strategies, exception filter, correlation-id interceptor, Winston logger, `env.schema.ts`, health controller, and related specs.

Status: `13 total` | `13 fixed` | `0 open`

Fixed:

- `#1–#5`: 5xx masking, correlation-id propagation/sanitization, production CORS enforcement, and circular message safety.
- `#6–#13`: JWT payload validation, secret separation, production Swagger gating, `fatal()` logger support, import-safe bootstrap, config-driven Google strategy checks, and health-probe throttler bypass.

Outcomes:

- Cross-cutting error handling now masks internals, preserves correlation IDs, and survives malformed payloads.
- Bootstrap is safer: production Swagger is disabled and `main.ts` is import-safe.
- Auth/config wiring now rejects malformed JWT payloads and shared access/refresh secrets.

Validation:

- Targeted cross-cutting unit specs, `pnpm --filter @irontrack/api typecheck`, `pnpm lint:code`, and `pnpm format:check`.
