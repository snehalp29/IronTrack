# IronTrack

Production-ready workout tracking application built as an Nx monorepo.

## Architecture

| App / Lib | Tech Stack | Port |
|-----------|-----------|------|
| `apps/api` | NestJS + Prisma + PostgreSQL | 3000 |
| `apps/web` | React + Vite + TailwindCSS | 5173 |
| `apps/mobile` | React Native (Expo) + SQLite | — |
| `apps/ml` | FastAPI + scikit-learn | 8000 |
| `libs/shared` | TypeScript DTOs, types, constants | — |

## Prerequisites

- **Node.js** ≥ 20 (see `.nvmrc`)
- **pnpm** ≥ 9
- **Docker** & Docker Compose (for PostgreSQL)
- **Python** ≥ 3.11 (for ML service)

## Quick Start

```bash
# 1. Clone & install
pnpm install

# 2. Copy env file and edit values
cp .env.example .env

# 3. Start database
pnpm docker:up

# 4. Run migrations & generate Prisma client
pnpm db:migrate
pnpm db:generate

# 5. Seed database (optional)
pnpm db:seed

# 6. Start services
pnpm serve:api   # NestJS API  → http://localhost:3000
pnpm serve:web   # React web   → http://localhost:5173
pnpm serve:ml    # FastAPI ML  → http://localhost:8000
```

## Project Structure

```
├── apps/
│   ├── api/          # NestJS REST API
│   ├── web/          # React + Vite web app
│   ├── mobile/       # Expo React Native app
│   └── ml/           # FastAPI ML service
├── libs/
│   └── shared/       # Shared types, DTOs, constants
├── infra/
│   └── docker/       # Docker Compose & Dockerfiles
├── tools/
│   └── scripts/      # Utility scripts
└── mock-screens/     # UI mockups (26 screens)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all projects |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all projects |
| `pnpm serve:api` | Start NestJS API (dev) |
| `pnpm serve:web` | Start React web app (dev) |
| `pnpm serve:ml` | Start FastAPI ML service (dev) |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |

## License

MIT
