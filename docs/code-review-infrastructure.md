# Code Review — Infrastructure & Cross-Cutting

Scope: `app.module.ts`, `main.ts`, auth guards/strategies, exception filter, correlation-id interceptor, Winston logger, `env.schema.ts`, health controller, and related specs.

Status: `13 total` | `13 fixed` | `0 open`

Fixed History:

- `#1–#5`: 5xx masking, correlation-id propagation/sanitization, production CORS enforcement, and circular message safety.
- `#6–#10`: JWT payload validation, secret separation, production Swagger gating, `fatal()` logger support, and import-safe bootstrap.
- `#11–#13`: config-driven Google strategy environment checks, circular `details` safety, and health-probe throttler bypass.

Outcomes:

- Cross-cutting error handling now masks internals, preserves correlation IDs, and survives malformed payloads.
- Bootstrap is safer: production Swagger is disabled and `main.ts` is import-safe.
- Auth/config wiring now rejects malformed JWT payloads and shared access/refresh secrets.

Validation:

- `pnpm --filter @irontrack/api test -- src/common/filters/http-exception.filter.spec.ts src/common/interceptors/correlation-id.interceptor.spec.ts src/common/logger/winston-logger.service.spec.ts src/config/env.schema.spec.ts src/modules/auth/guards/jwt-auth.guard.spec.ts src/modules/auth/strategies/jwt.strategy.spec.ts src/modules/auth/strategies/google.strategy.spec.ts src/modules/health/health.controller.spec.ts src/app.module.spec.ts src/main.spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm lint:code`
- `pnpm format:check`
