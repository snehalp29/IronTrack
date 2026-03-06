# Code Review — Infrastructure & Cross-Cutting (Compact)

**Branch:** `phase_one`  
**Date:** 2026-03-06

## Scope

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

## Status

- Total findings: **13**
- Open: **0**
- Fixed: **13**

## Fixed History

- `#1–#5`: 5xx masking, correlation-id propagation, correlation-id sanitization, production CORS enforcement, and circular message safety.
- `#6–#10`: JWT payload validation, secret separation, production Swagger gating, `fatal()` logger support, and import-safe bootstrap behavior.
- `#11–#13`: config-driven Google strategy environment checks, circular `details` safety, and throttler bypass for health probes.

## Key Outcomes

- Cross-cutting error handling now masks internals, preserves correlation IDs, and survives bad payload shapes.
- Bootstrap behavior is safer: production Swagger is disabled and `main.ts` can be imported without side effects.
- Auth/config wiring now rejects malformed JWT payloads and shared access/refresh secrets.
- Logger and health-probe behavior now align with Nest 11 expectations and operational use.

## Validation

- `pnpm --filter @irontrack/api test -- src/common/filters/http-exception.filter.spec.ts src/common/interceptors/correlation-id.interceptor.spec.ts src/common/logger/winston-logger.service.spec.ts src/config/env.schema.spec.ts src/modules/auth/guards/jwt-auth.guard.spec.ts src/modules/auth/strategies/jwt.strategy.spec.ts src/modules/auth/strategies/google.strategy.spec.ts src/modules/health/health.controller.spec.ts src/app.module.spec.ts src/main.spec.ts`
- `pnpm --filter @irontrack/api typecheck`
- `pnpm lint:code`
- `pnpm format:check`
