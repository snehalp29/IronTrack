# Code Review — Infrastructure & Cross-Cutting (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-06  
**Scope:**

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
- `apps/api/src/modules/auth/strategies/google.strategy.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/interceptors/correlation-id.interceptor.ts`
- `apps/api/src/common/logger/winston-logger.service.ts`
- `apps/api/src/config/env.schema.ts`
- `apps/api/src/modules/health/health.controller.ts`
- Related infrastructure tests (`*.spec.ts`)

---

## Current Status

- Total findings tracked: **13**
- Open findings: **0**
- Fixed findings: **13**
- Follow-up sweep result: no additional concrete `P0`-`P4` defects were identified in the reviewed infrastructure scope.

---

## Findings Index

| #   | Severity | File                                                | Finding (Short)                                                                           | Status   |
| --- | -------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| 1   | P1       | `common/filters/http-exception.filter.ts`           | 5xx `HttpException` bodies leaked internal messages/details                               | ✅ Fixed |
| 2   | P1       | `common/interceptors/correlation-id.interceptor.ts` | Unsanitized inbound correlation IDs were echoed into response headers                     | ✅ Fixed |
| 3   | P1       | `common/filters/http-exception.filter.ts`           | Pre-interceptor failures missed `x-correlation-id` response headers                       | ✅ Fixed |
| 4   | P2       | `config/env.schema.ts`                              | Production boot accepted missing/blank `CORS_ORIGINS` and fell back to dev origins        | ✅ Fixed |
| 5   | P2       | `common/filters/http-exception.filter.ts`           | Circular message payloads could crash normalization                                       | ✅ Fixed |
| 6   | P1       | `modules/auth/strategies/jwt.strategy.ts`           | Malformed JWT payloads were accepted without runtime shape checks                         | ✅ Fixed |
| 7   | P1       | `config/env.schema.ts`                              | Access and refresh JWT secrets could be configured to the same value                      | ✅ Fixed |
| 8   | P2       | `main.ts`                                           | Swagger docs were registered in production by default                                     | ✅ Fixed |
| 9   | P2       | `common/logger/winston-logger.service.ts`           | Custom logger omitted `fatal()` and dropped Nest fatal logs                               | ✅ Fixed |
| 10  | P3       | `main.ts`                                           | Module import auto-bootstrapped the app, causing side effects and blocking unit tests     | ✅ Fixed |
| 11  | P3       | `modules/auth/strategies/google.strategy.ts`        | Google strategy environment checks ignored validated `ConfigService` `NODE_ENV`           | ✅ Fixed |
| 12  | P2       | `common/filters/http-exception.filter.ts`           | Circular/non-serializable `details` payloads could turn 4xx handling into a secondary 500 | ✅ Fixed |
| 13  | P3       | `modules/health/health.controller.ts`               | Health probes inherited the global throttler                                              | ✅ Fixed |

---

## Key Outcomes

- Error handling is now safer across both unknown failures and handled `HttpException` paths:
  - 5xx bodies are masked,
  - correlation IDs are always attached,
  - circular `message` and `details` values no longer break serialization.
- Request-correlation handling now validates inbound header values before reuse.
- Bootstrap behavior is tighter:
  - Swagger is disabled in production,
  - `main.ts` is import-safe for tests and tooling,
  - health probes bypass the shared rate limit.
- Auth/config hardening now rejects malformed JWT payloads and invalid JWT secret separation at startup.
- Logger compatibility is more complete with explicit `fatal()` support for Nest 11 log calls.

---

## Validation Commands

- `pnpm --filter @irontrack/api test -- src/common/filters/http-exception.filter.spec.ts src/common/interceptors/correlation-id.interceptor.spec.ts src/common/logger/winston-logger.service.spec.ts src/config/env.schema.spec.ts src/modules/auth/guards/jwt-auth.guard.spec.ts src/modules/auth/strategies/jwt.strategy.spec.ts src/modules/auth/strategies/google.strategy.spec.ts src/modules/health/health.controller.spec.ts src/app.module.spec.ts src/main.spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm lint:code`
- `pnpm format:check`
