# IronTrack

IronTrack is a full-stack workout tracking monorepo with:

- NestJS + Prisma API (`apps/api`)
- React web app (`apps/web`)
- Shared TypeScript library (`libs/shared`)

## Monorepo Structure

- `apps/api`: REST API (`/api/v1`)
- `apps/web`: React web client
- `libs/shared`: shared enums/types/validation/utils
- `infra/docker`: Dockerfiles and compose definitions
- `tools/scripts`: one-command setup and DB reset scripts

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm serve:api
pnpm serve:web
```

## Local API + Demo Data

Run this on your machine:

```bash
pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:seed:demo
pnpm serve:api
curl -s http://localhost:3000/api/v1/health
```

Demo login after seed:

```bash
curl -s http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@irontrack.local","password":"DemoPass123!"}'
```

If Docker fails with `bind: address already in use` on `3000`, set
`WEB_PORT=3001` in your root `.env`, then run:

```bash
pnpm docker:up
```

## Docker

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

One-command setup:

```bash
./tools/scripts/setup.sh
```

`setup.sh` installs dependencies, starts Docker services, waits for health checks,
applies Prisma migrations, and seeds the database.

Reset DB:

```bash
./tools/scripts/reset-db.sh
```

## Testing

```bash
pnpm test:api
pnpm test:e2e:api
pnpm test:web
pnpm test:e2e:web
pnpm test:shared
```

## Branch Protection (Recommended)

Configure GitHub branch protection for `main` with:

1. Require pull request before merging.
2. Require status checks to pass before merging (`CI / lint-test-build`).
3. Require branches to be up to date before merging.
4. Include administrators.
5. Restrict force pushes and branch deletion.

## CI/CD

- `.github/workflows/ci.yml`: installs dependencies, runs lint/typecheck, API unit + e2e tests, web unit + Playwright tests, shared tests, and builds API/web.
- `.github/workflows/docker.yml`: builds API/web Docker images on pushes to `main`.

## Notes

- API soft-delete is enabled via Prisma middleware for core entities.
- Workout business logic includes PR detection, volume caching, streak updates, completion %, and superset ordering.
