# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IronTrack is a full-stack workout tracking application organized as a pnpm monorepo managed with Nx:

- `apps/api` — NestJS v11 REST API (`@irontrack/api`)
- `apps/web` — React 19 + Vite SPA (`@irontrack/web`)
- `libs/shared` — Shared TypeScript types, enums, validation, and utilities (`@irontrack/shared`)
- `infra/docker` — Dockerfiles and compose definitions
- `tools/scripts` — Setup and DB reset scripts

## Commands

All commands run from the repo root using pnpm.

### Development

```bash
pnpm serve:api          # Start API in watch mode
pnpm serve:web          # Start Vite dev server
pnpm db:generate        # Run prisma generate
pnpm db:migrate         # Run prisma migrate dev
pnpm db:seed            # Seed base data
pnpm db:seed:demo       # Seed demo user + data
pnpm db:studio          # Open Prisma Studio
pnpm docker:up          # Start Postgres + web via Docker Compose
pnpm docker:down        # Stop Docker services
```

### Testing

```bash
pnpm test:api           # API unit tests (Jest)
pnpm test:e2e:api       # API e2e tests (Jest + Supertest)
pnpm test:web           # Web unit tests (Vitest)
pnpm test:e2e:web       # Web e2e tests (Playwright)
pnpm test:shared        # Shared lib tests (Vitest)
```

Run a single test file:

```bash
# API
pnpm --filter @irontrack/api test -- --testPathPattern=auth.service

# Web
pnpm --filter @irontrack/web test -- activeWorkoutStore

# Shared
pnpm --filter @irontrack/shared test -- volume
```

### Linting & Formatting

```bash
pnpm lint:code          # ESLint (0 warnings allowed)
pnpm format:check       # Prettier check
pnpm lint:fix           # ESLint --fix + Prettier write
pnpm format             # Prettier write
pnpm typecheck          # tsc --noEmit across all packages
```

### Build

```bash
pnpm build              # Build api + web
pnpm build:api
pnpm build:web
```

## API Architecture (`apps/api`)

### Module Structure

Feature modules live in `src/modules/`: `auth`, `catalog`, `checklist`, `exercises`, `health`, `ml-client`, `progress`, `sessions`, `streak`, `users`, `workout-templates`.

Domain business logic services (decoupled from HTTP) live in `src/services/`: `completion`, `pr-detection`, `streak`, `superset`, `volume`.

### Global Guards

Two guards apply to every route via `APP_GUARD` tokens in `AppModule`:

1. `ThrottlerGuard` — rate-limits at 100 req/60s
2. `JwtAuthGuard` — requires valid JWT by default

Use `@Public()` decorator on a controller method or class to bypass JWT auth. Use `@CurrentUser()` to extract `{ sub: string, email: string }` from the JWT payload.

### Validation Pattern

Controllers use `ZodValidationPipe` applied per-route with Zod schemas defined in `dto/*.schemas.ts` files. Global `ValidationPipe` (class-validator/class-transformer) is also registered but Zod is preferred for new DTOs.

### Prisma & Database

- `PrismaService` extends `PrismaClient` and is provided via `PrismaModule` (global).
- Uses `@prisma/adapter-pg` for PostgreSQL connection.
- Soft-delete is applied on core entities via a `deletedAt` field — always filter with `deletedAt: null` in queries.
- Schema at `apps/api/prisma/schema.prisma`.

### Environment

Validated with Zod at startup via `validateEnv` in `src/config/env.schema.ts`. Required vars: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Google OAuth vars are only required in production.

### Auth Flow

JWT-based with access tokens (default 15m) and refresh tokens (default 7d) stored hashed in the DB. Supports local (email/password) and Google OAuth. Refresh tokens are rotated on each use.

### Logging & Infrastructure

- Winston logger via `WinstonLoggerService`.
- `CorrelationIdInterceptor` injects/propagates `x-correlation-id` headers.
- `HttpExceptionFilter` normalizes error responses.
- Swagger docs available at `{API_PREFIX}/docs` (default: `http://localhost:3000/api/v1/docs`).

## Web Architecture (`apps/web`)

### Routing

React Router v7 in `src/App.tsx`. All authenticated routes are nested under `AppLayout`. Public routes: `/login`, `/register`.

### Data Fetching

TanStack Query (`@tanstack/react-query`) for server state. All requests go through `apiFetch` in `src/api/client.ts`, which targets `VITE_API_URL` (defaults to `http://localhost:3000/api/v1`).

### State Management

Zustand for client state. `useActiveWorkoutStore` in `src/stores/activeWorkoutStore.ts` manages in-progress workout state and is persisted to `localStorage` under the key `irontrack-active-workout`.

### Testing Approach

Web tests use **Vitest** and a custom DOM-free React tree utility (`src/testing/react-tree.ts`) — **not** `@testing-library/react`. Tests render components directly and traverse the React element tree using helpers like `findButtonByLabel`, `findForm`, `nodeText`, etc. Do not introduce `@testing-library/react` unless explicitly requested.

## Shared Library (`libs/shared`)

Exports: types, enums, validation helpers, and utility functions for volume calculation (`volume`), one-rep max estimation (`one-rm`), date helpers (`dates`), unit conversion (`units`), and a sync queue (`sync-queue`). Import from `@irontrack/shared` in both api and web.

## Code Review Protocol (from AGENTS.md)

Before applying changes, proactively review touched files for defects, performance issues, and security risks. List findings by severity (`P0`, `P1`, `P2`) with file and line references. Apply fixes with a failing test first, then the code fix (TDD).

## Testing Standards

- API tests have **100% coverage threshold** (statements, branches, functions) enforced by Jest config.
- E2E API tests use Supertest against a running NestJS app; test helpers in `src/testing/test-utils.ts` create and clean up test data.
- E2E web tests use Playwright (`playwright.config.ts`).
