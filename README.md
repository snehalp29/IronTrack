# IronTrack

IronTrack is a full-stack workout tracking monorepo with:

- NestJS + Prisma API (`apps/api`)
- FastAPI rule-based ML service (`apps/ml`)
- React web app (`apps/web`)
- Expo React Native mobile app (`apps/mobile`)
- Shared TypeScript library (`libs/shared`)

## Monorepo Structure

- `apps/api`: REST API (`/api/v1`)
- `apps/ml`: ML microservice (`/health`, `/api/v1/*`)
- `apps/web`: React web client
- `apps/mobile`: Expo mobile client with offline SQLite queue
- `libs/shared`: shared enums/types/validation/utils
- `infra/docker`: Dockerfiles and compose definitions
- `tools/scripts`: one-command setup and DB reset scripts

## Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+
- Poetry 1.8+
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

ML service:

```bash
cd apps/ml
poetry install
poetry run uvicorn app.main:app --reload --port 5000
```

Mobile app:

```bash
pnpm --filter @irontrack/mobile start
```

## Docker

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

One-command setup:

```bash
./tools/scripts/setup.sh
```

Reset DB:

```bash
./tools/scripts/reset-db.sh
```

## Testing

```bash
pnpm test:api
pnpm test:web
pnpm test:shared
pnpm test:ml
```

## Branch Protection (Recommended)

Configure GitHub branch protection for `main` with:

1. Require pull request before merging.
2. Require status checks to pass before merging (`CI / lint-test-build`).
3. Require branches to be up to date before merging.
4. Include administrators.
5. Restrict force pushes and branch deletion.

## CI/CD

- `.github/workflows/ci.yml`: installs dependencies, runs API/web/shared/ML tests, and builds API/web.
- `.github/workflows/docker.yml`: builds API/ML/web Docker images on pushes to `main`.

## Notes

- API soft-delete is enabled via Prisma middleware for core entities.
- Workout business logic includes PR detection, volume caching, streak updates, completion %, and superset ordering.
- Mobile offline sync queue uses SQLite tables: `pending_sessions`, `pending_sets`, and `sync_queue`.
