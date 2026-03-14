---
name: Irontrack Plan Agent
description: Research and plan with the Plan agent
agent: Plan
argument-hint: Describe what you want to plan or research
---

## Role

You are a senior full-stack architect.
Generate a production-ready monorepo for a workout tracking app with ML support.

## 🎯 Goal

Build a containerized, production-ready system with:

- API: NestJS + Prisma + PostgreSQL
- ML Service: Python + FastAPI
- Web: React (Vite + TypeScript)
- Mobile: React Native (Expo + TypeScript)
- Deployment: Docker Compose (local homelab ready)

Prioritize: clean architecture, scalability, security, testability, and fast development for a solo developer using AI assistance.

---

## 🏗 1️⃣ MONOREPO STRUCTURE using NX

Use Nx for monorepo management with pnpm workspaces. Nx provides better tooling for large monorepos, caching, and task orchestration.

Create this structure:

```bash
repo/
  apps/
    api/          # NestJS + Prisma
    ml/           # FastAPI ML service
    web/          # React (Vite)
    mobile/       # React Native (Expo)
  libs/
    shared/       # Shared TypeScript types and utilities
  infra/
    docker/
      docker-compose.yml
      Dockerfile.api
      Dockerfile.ml
      Dockerfile.web
  tools/
    scripts/      # Build and deployment scripts
  README.md
  nx.json
  pnpm-workspace.yaml
```

---

## 🧠 2️⃣ BACKEND: API (NestJS + Prisma)

### Tech Stack

- Node 24
- NestJS
- Prisma ORM
- PostgreSQL
- JWT auth (access + refresh)
- Zod validation
- OpenAPI (Swagger)

### Prisma Schema Must Support

#### Models:

- User
- ExerciseTemplate (global + user custom)
- MuscleGroup
- Equipment
- WorkoutTemplate
- WorkoutSession
- SessionExercise
- Set (polymorphic or discriminator-based)
- ExerciseNote
- SessionNote
- PRRecord
- ChecklistItem
- UserStreak (overall streak)
  - currentStreakDays
  - longestStreakDays
  - lastCompletedDate
  - rules: “completed at least 1 workout/day”

#### Constraints:

- User cannot duplicate custom exercise names
- Proper foreign keys
- Indexes on:
  - ExerciseNote: Unique (userId, exerciseTemplateId), Index (userId)
  - PRRecord: Unique (userId, exerciseTemplateId, prType), Index (userId, exerciseTemplateId)
  - UserStreak: Unique (userId, streakType), Index (userId)
  - WorkoutSession: Index (userId, startedAt), Index (userId, workoutTemplateId)
  - SessionExercise: Unique (sessionId, orderIndex), Index (sessionId)
  - Set: Unique (sessionExerciseId, orderIndex), Optional Unique (sessionExerciseId, idempotencyKey), Index (sessionExerciseId)
  - ChecklistItem: Unique (userId, date, type), Index (userId, date)

#### Set schema must support:

- weight + reps
- bodyweight only
- duration
- reps only

### Prisma Schema Details (with Markdown comment syntax)

IMPORTANT:

- Inline html style comments starting with `<!-- -->` are explanations only.
- They MUST NOT become schema fields.
- Generate a complete Prisma schema with models, relations, enums, constraints, and indexes based strictly on the structured bullets below.
- Pages in parentheses indicate where the model is primarily used in the app, but models may be referenced across multiple pages.

---

## User

<!-- (Pages: common top header) -->

- id (uuid)
<!-- (Primary identifier) -->
- email (string, unique)
<!-- (Login identity for authentication) -->
- passwordHash (string)
<!-- (Secure password hash storage; never store raw password) -->
- name? (string)
<!-- (Display name for UI personalization) -->
- createdAt (datetime)
<!-- (Audit + sorting) -->
- updatedAt (datetime)
<!-- (Audit + cache invalidation) -->

---

## MuscleGroup (catalog)

<!-- (Pages: 2 Workout Preview Screen Header (target muscles), 8 Exercise Detail – Form Guide Tab (Muscle Groups section) 13 Workout Completion –Up Next Screen (Focus Area),15 Create Exercise (pickers)) -->

- id
  <!-- (Primary identifier) -->
- name (string, unique)
  <!-- (Canonical muscle group label: "Hamstrings", "Upper Back") -->
- imageUrl? (string)
  <!-- (Image for muscle selector and muscle-map visuals) -->
- iconUrl? (string)
  <!-- (Optional small icon for chips/lists) -->
- sortOrder? (int)
  <!-- (Stable ordering in pickers and UI) -->
- createdAt (datetime)
  <!-- (Audit) -->
- updatedAt (datetime)
    <!-- (Audit) -->
  <!-- (Why: images enable muscle group pickers and body-map visualizations without hardcoding assets in clients.) -->

---

## Equipment (catalog)

<!-- (Pages: Create Exercise equipment picker, Exercise Library filters, Exercise Detail) -->

- id
  <!-- (Primary identifier) -->
- name (string, unique)
  <!-- (Canonical equipment label: "Barbell", "Dumbbell", "Bodyweight") -->
- iconUrl? (string)
  <!-- (Optional icon for UI) -->
- sortOrder? (int)
  <!-- (Stable ordering in pickers and UI) -->
- createdAt (datetime)
  <!-- (Audit) -->
- updatedAt (datetime)
  <!-- (Audit) -->

---

## ExerciseTemplate (global + user custom)

<!-- (Pages: Exercise Library, Create Exercise, Exercise Detail Form Guide/History, Active Workout, Workout Preview) -->

- id
  <!-- (Primary identifier for exercise definition) -->
- name (string)
  <!-- (Display name, e.g., "Barbell Deadlift") -->
- description? (text)
  <!-- (How-to text shown in Form Guide) -->
- exerciseType (enum: WEIGHT_REPS | BODYWEIGHT | DURATION | REPS_ONLY | BODYWEIGHT_PLUS_WEIGHT)
  <!-- (Controls logging UI + Set.payload validation) -->
- isGlobal (boolean)
  <!-- (True if system-provided exercise; false if user-created) -->
- ownerUserId? (FK → User)
  <!-- (Owner for custom exercise; null for global exercises) -->
- primaryMuscleGroupId (FK → MuscleGroup)
  <!-- (Main muscle group for filters + muscle coverage weighting) -->
- defaultSets? (int)
  <!-- (Prefill set count when adding exercise to a workout) -->
- repMin? (int)
  <!-- (Target rep range lower bound for UI + guidance) -->
- repMax? (int)
  <!-- (Target rep range upper bound for UI + guidance) -->
- defaultCues? (text)
  <!-- (Optional default coaching cues for global exercises; user cues in ExerciseNote) -->
- createdAt (datetime)
  <!-- (Audit) -->
- updatedAt (datetime)
  <!-- (Audit) -->

Constraints:

- If ownerUserId is NOT null (custom exercise), enforce unique (ownerUserId, lower(name))
  <!-- (Prevents duplicate custom exercise names per user) -->
- If isGlobal = true then ownerUserId must be null
  <!-- (Clear ownership model) -->

---

## ExerciseTemplateSecondaryMuscle (join: exercise → secondary muscles)

<!-- (Pages: Exercise Detail Form Guide, Weekly Progress coverage, Create Exercise secondary selection) -->

- exerciseTemplateId (FK → ExerciseTemplate)
<!-- (Which exercise the association belongs to) -->
- muscleGroupId (FK → MuscleGroup)
  <!-- (Which secondary muscle is involved) -->
  <!-- (Purpose: supports multiple muscle groups per exercise (e.g., Deadlift hits glutes, hamstrings, back).) -->
  Constraints:
- Unique (exerciseTemplateId, muscleGroupId)
<!-- (Prevent duplicate associations) -->

---

## ExerciseTemplateEquipment (join: exercise → equipment tags)

<!-- (Pages: Exercise Library filters, Create Exercise, Exercise Detail) -->

- exerciseTemplateId (FK → ExerciseTemplate)
<!-- (Which exercise) -->
- equipmentId (FK → Equipment)
  <!-- (Which equipment tag applies) -->
  Constraints:
- Unique (exerciseTemplateId, equipmentId)
<!-- (Prevent duplicate associations) -->

---

## ExerciseVideo (exercise → multiple instructional videos)

<!-- (Pages: Exercise Detail Form Guide, Active Workout video tile, Workout Preview optional) -->

- id
<!-- (Primary identifier) -->
- exerciseTemplateId (FK → ExerciseTemplate)
<!-- (Links video instructions to an exercise definition) -->
- provider (enum: YOUTUBE | VIMEO | OTHER)
<!-- (Provider-specific rendering/embedding rules) -->
- url (string)
<!-- (Canonical video link) -->
- title? (string)
<!-- (Display title like "Beginner Form" or "Common Mistakes") -->
- thumbnailUrl? (string)
<!-- (Fast UI rendering without external provider calls) -->
- isPrimary (boolean)
<!-- (Default video shown first in Form Guide) -->
- sortOrder (int)
<!-- (Deterministic ordering of videos) -->
- createdAt (datetime)
<!-- (Audit) -->
- updatedAt (datetime)
<!-- (Audit) -->

Constraints:

- Unique (exerciseTemplateId, sortOrder)
<!-- (Stable ordering per exercise) -->
- Optional: enforce only one isPrimary per exercise
  <!-- (Prefer exactly one “primary” video) -->
  <!-- (Do NOT store videos in WorkoutSession; videos are reusable exercise-level assets.) -->

---

## WorkoutTemplate (planned workout/program day)

<!-- (Pages: Dashboard program card, Workout Preview, Up Next) -->

- id
<!-- (Primary identifier) -->
- userId (FK → User)
<!-- (Owner of the template/program day) -->
- name (string)
<!-- (Displayed name like "Lower 2" or "Push") -->
- description? (text)
<!-- (Optional notes/intention) -->
- createdAt (datetime)
<!-- (Audit) -->
- updatedAt (datetime)
<!-- (Audit) -->

---

## WorkoutTemplateExercise (join: ordered template exercises + defaults + supersets)

<!-- (Pages: Workout Preview, Reorder modal, Superset setup, Session generation) -->

- id
<!-- (Primary identifier) -->
- workoutTemplateId (FK → WorkoutTemplate)
<!-- (Which template this row belongs to) -->
- exerciseTemplateId (FK → ExerciseTemplate)
<!-- (Which exercise is included) -->
- orderIndex (int)
<!-- (Exercise order in Preview and generated Session) -->
- defaultSets? (int)
<!-- (Template override for sets) -->
- repMin? (int)
<!-- (Template override rep range low) -->
- repMax? (int)
<!-- (Template override rep range high) -->
- supersetGroupKey? (string)
<!-- (Groups exercises into supersets like SS1 for 1A/1B pairing) -->
- createdAt (datetime)
<!-- (Audit) -->
- updatedAt (datetime)
<!-- (Audit) -->

Constraints / Indexes:

- Unique (workoutTemplateId, orderIndex)
<!-- (Stable ordering) -->
- Index (workoutTemplateId)
<!-- (Fast template load) -->
- Index (exerciseTemplateId)
<!-- (Reverse lookup) -->
- Allow duplicates by NOT enforcing unique(workoutTemplateId, exerciseTemplateId)
<!-- (Supports repeated exercises in a template) -->

---

## WorkoutSession (performed workout instance)

<!-- (Pages: Active Workout, Completion, Summary, History, Dashboard rings, Streak) -->

- id
<!-- (Primary identifier) -->
- userId (FK → User)
<!-- (Owner) -->
- workoutTemplateId? (FK → WorkoutTemplate)
<!-- (Nullable; ad-hoc sessions have no template) -->
- startedAt (datetime)
<!-- (Timer start; duration calculations) -->
- finishedAt? (datetime)
<!-- (Timer end; drives streak/rings) -->
- status (enum: IN_PROGRESS | FINISHED)
<!-- (Resume vs completed behavior) -->
- endedReason? (enum: USER_ENDED | AUTO_TIMEOUT)
<!-- (Analytics/debug; why session ended) -->
- notes? (text)
<!-- (Session-level note) -->
- totalVolume? (number)
<!-- (Cached value for fast dashboard/summary; derived from sets) -->
- durationSeconds? (int)
<!-- (Cached for fast UI; derived from timestamps) -->
- createdAt (datetime)
<!-- (Audit) -->
- updatedAt (datetime)
<!-- (Audit) -->

Indexes:

- Index (userId, startedAt)
<!-- (Dashboard/history queries) -->
- Index (userId, workoutTemplateId)
<!-- (Template-based history queries) -->

---

## SessionExercise (exercise instance inside a session)

<!-- (Pages: Active Workout cards, exercise menu actions, reorder in-session, superset in-session) -->

- id
<!-- (Primary identifier) -->
- sessionId (FK → WorkoutSession)
<!-- (Which session) -->

- exerciseTemplateId (FK → ExerciseTemplate)
<!-- (Which exercise definition is performed) -->

- orderIndex (int)
<!-- (Exercise order within session; reorder modal) -->

- supersetGroupKey? (string)
<!-- (Superset grouping; may differ from template if user edits) -->

- notes? (text)
<!-- (Per-exercise notes during the session) -->

- createdAt (datetime)
<!-- (Audit) -->

- updatedAt (datetime)
<!-- (Audit) -->

Constraints / Indexes:

- Unique (sessionId, orderIndex)
<!-- (Stable in-session ordering) -->
- Index (sessionId)
<!-- (Fast session load) -->

---

## Set (logged set inside a session exercise)

<!-- (Pages: Active Workout sets table, Exercise History, PR detection, Summary calculations) -->

- id
<!-- (Primary identifier) -->

- sessionExerciseId (FK → SessionExercise)
<!-- (Which session exercise the set belongs to) -->

- orderIndex (int)
<!-- (Set number / ordering) -->

- type (enum same as ExerciseTemplate.exerciseType)
<!-- (Ensures payload is interpreted correctly) -->

- payload (Json, required)
<!-- (Stores set details; validate strictly with Zod based on type) -->

- isCompleted (boolean)
<!-- (Checkbox state; resilient to offline edits) -->

- completedAt? (datetime)
<!-- (Optional completion timestamp) -->

- idempotencyKey? (string)
<!-- (Prevents duplicates during offline sync/retries; unique per sessionExercise) -->

- createdAt (datetime)
<!-- (Audit) -->

- updatedAt (datetime)
<!-- (Audit) -->

Constraints / Indexes:

- Unique (sessionExerciseId, orderIndex)
<!-- (Stable set ordering) -->
- Optional Unique (sessionExerciseId, idempotencyKey)
<!-- (Idempotent set creation) -->
- Index (sessionExerciseId)
<!-- (Fast load for exercise history) -->

Payload validation examples (Zod-enforced):

<!-- (WEIGHT_REPS: { weight: number, reps: number, rpe?: number }) -->
<!-- (BODYWEIGHT: { reps: number, rpe?: number }) -->
<!-- (BODYWEIGHT_PLUS_WEIGHT: { addedWeight: number, reps: number, rpe?: number }) -->
<!-- (DURATION: { seconds: number, distanceMeters?: number }) -->
<!-- (REPS_ONLY: { reps: number }) -->

---

## ExerciseNote (persistent personal cues per user/exercise)

<!-- (Pages: Exercise Detail personal cues, Active Workout reference, Form Guide) -->

- id
<!-- (Primary identifier) -->

- userId (FK → User)
<!-- (Owner of the note) -->

- exerciseTemplateId (FK → ExerciseTemplate)
<!-- (Which exercise the cues apply to) -->

- note (text)
<!-- (User cues like "brace core", "avoid knee lockout") -->

- createdAt (datetime)
<!-- (Audit) -->

- updatedAt (datetime)
<!-- (Audit) -->

Constraints:

- Unique (userId, exerciseTemplateId)
<!-- (One current persistent note per user/exercise) -->

---

## SessionNote (session-level notes)

<!-- (Pages: Workout Summary, Post-workout reflection, future Notes hub) -->

- id
<!-- (Primary identifier) -->

- sessionId (FK → WorkoutSession)
<!-- (Which session) -->

- note (text)
<!-- (Free-form session note) -->

- createdAt (datetime)
<!-- (Audit) -->

- updatedAt (datetime)
<!-- (Audit) -->

Indexes:

- Index (sessionId)
<!-- (Fast retrieval) -->

---

## PRRecord (derived performance records)

<!-- (Pages: Exercise History tab PR cards, workout completion highlights) -->

- id
<!-- (Primary identifier) -->

- userId (FK → User)
<!-- (Owner) -->

- exerciseTemplateId (FK → ExerciseTemplate)
<!-- (PR is per exercise) -->

- prType (enum: MAX_WEIGHT | MAX_VOLUME | MAX_REPS | MAX_1RM_EST)
<!-- (Supports multiple PR metrics) -->

- value (number)
<!-- (Numeric PR value) -->

- achievedAt (datetime)
<!-- (When PR occurred) -->

Constraints / Indexes:

- Unique (userId, exerciseTemplateId, prType)
<!-- (One PR per type per exercise per user) -->
- Index (userId, exerciseTemplateId)
<!-- (Fast exercise history/PR fetch) -->

---

## UserStreak (habit streaks)

<!-- (Pages: Streak screen, Dashboard badge) -->

- id
<!-- (Primary identifier) -->

- userId (FK → User)
<!-- (Owner) -->

- streakType (enum: WORKOUT | CHECKLIST)
<!-- (Supports separate streak types) -->

- currentStreakDays (int)
<!-- (Displayed in UI) -->

- longestStreakDays (int)
<!-- (Displayed as best streak) -->

- lastCompletedDate (date)
<!-- (Used to compute next streak increment) -->

MVP rule:

<!-- (WORKOUT streak increments if user has >= 1 WorkoutSession FINISHED on that date, based on finishedAt local date) -->

Constraints:

- Unique (userId, streakType)
<!-- (One streak record per type per user) -->

---

## ChecklistItem (daily checklist completion)

<!-- (Pages: Dashboard checklist, weekly rings, streak if CHECKLIST enabled) -->

- id
<!-- (Primary identifier) -->

- userId (FK → User)
<!-- (Owner) -->

- date (date)
<!-- (Day grouping; YYYY-MM-DD) -->

- type (enum: WORKOUT | WARMUP | MOBILITY | NOTES)
<!-- (Standard checklist items; extensible) -->

- isCompleted (boolean)
<!-- (Fast ring computation) -->

- completedAt? (datetime)
<!-- (Optional timestamp for analytics) -->

Constraints / Indexes:

- Unique (userId, date, type)
<!-- (No duplicates) -->
- Index (userId, date)
<!-- (Fast dashboard/week queries) -->

## Safe deletes

<!-- (Avoid cascading deletes that remove history; prefer soft-delete flags if needed.) -->
<!-- (Deleting ExerciseTemplate should be restricted if referenced by WorkoutSession/SessionExercise.) -->

---

#### Progress:

- GET /progress/weekly

#### Business Logic to Implement

- Volume calculation
- PR detection
- Muscle coverage %
- Streak calculation
- Completion %
- Superset grouping
- Incomplete workout detection

### Validation & Error Handling

- Use Zod for all input validation
- Return standardized error responses (e.g., { error: { code, message } })
- HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 422, 500
- Input sanitization and SQL injection prevention via Prisma
- Rate limiting for auth endpoints

---

## 🤖 3️⃣ ML SERVICE (FastAPI)

### Create a separate service in apps/ml.

#### Tech:

- Python 3.11
- FastAPI
- Pydantic v2
- Uvicorn

#### Endpoints:

- POST /predict/next-load
- POST /predict/rest-time
- POST /risk/pain-pattern
- POST /recommendations/session

#### For now:

- Implement rule-based logic (no heavy ML yet).
- Design so real ML models can be plugged in later.

####ML service must:

- Be stateless
- Not write directly to DB
- Accept structured input from API

---

## 🌐 4️⃣ WEB (React)

- Vite + React + TypeScript
- TanStack Query for data fetching
- Zustand for local state
- Tailwind CSS
- React Router for navigation
- Form handling with React Hook Form + Zod

### Pages:

- 1 Dashboard : Header (weekly rings, User logo), Body (checklist, streak entry), Footer (resume/start workout CTA, Lessons, Nutitions, Dashboard, workout, Progress )
- 2 Workout Preview: Header (target muscles), Body (exercise list), Footer (warmup CTA, start workout)
- 3 Active Workout: Header (live logging), Body (sets table, rest timer, notes), Footer (finish)
- 4 Exercise Detail:
  - Form Guide tab (Header: video/placeholder, instructions, cues)
  - History tab (Header: PRs, volume stats, set history)
- 5 Post-Workout Flow:
  - Workout Completion (celebration, share, CTA to summary)
  - Workout Summary
  - Weekly Progress (muscle map/coverage, workouts/week)
  - Up Next
  - Streak
- 6 Exercise Library:
  - Select Exercise (search, filters, muscle groups)
  - Create Exercise (full flow: name → equipment → type → primary/secondary mscles → defaults)

### Modals/Bottom Sheets (MVP)

- Exercise overflow menu: swap / form guide / reorder / superset / history / remove
- Reorder exercises modal
- Superset modal
- Incomplete sets modal
- Pickers for create exercise (equipment/type/muscles)

Use shared types from libs/shared.

## 📦 SHARED PACKAGE / libs

Create libs/shared with:

- TypeScript types for all API DTOs (requests/responses)
- Enums for exercise types, muscle groups, equipment
- Utility functions (date formatting, validation helpers)
- Constants (API endpoints, default values)

## 📱 5️⃣ MOBILE (React Native + Expo)

- Expo SDK 50+
- TypeScript
- React Navigation (stack + tab)
- Same API contracts as web
- AsyncStorage for local persistence
- Offline support for workout sessions
  - store in AsyncStorage/SQLite
  - when online: sync session + sets with idempotency keys
  - optimistic locking on SessionExercise reorder/swap
- Push notifications (optional, mock)

Use shared DTO types

---

## 🐳 6️⃣ DOCKER SETUP

Create docker-compose.yml with:

#### Services:

- postgres (PostgreSQL 15, persistent volume)
- api (NestJS app, expose 4000)
- ml (FastAPI app, expose 5000)
- web (Vite dev server, optional, expose 3000)
- mobile (Expo dev server, optional, expose 8081)

#### Features:

- Environment variables from .env file
- Health checks for all services
- Proper networking between services
- Volume mounts for hot reload in dev

## 🧪 9️⃣ TESTING STRATEGY

- Unit tests for all services, controllers, utilities
- Integration tests for API endpoints
- E2E tests for critical user flows (registration, workout session)
- Test database with migrations
- Mock external services (ML service)
- Aim for 95%+ code coverage
- Use Jest for Node.js, pytest for Python, Vitest for React.

## 🚀 10️⃣ DEPLOYMENT & CI/CD

- GitHub Actions for CI: lint, test, build on PR/merge
- Docker images for all services
- docker-compose for local dev
- Environment configs: .env files for dev/staging/prod
- Database migrations on deploy
- Health checks and graceful shutdown
- Monitoring: basic logging, prepare for metrics (Prometheus) port.

---

## 🔐 7️⃣ NON-FUNCTIONAL REQUIREMENTS

- Idempotent set creation
  - idempotencyKey on Set (unique per user or per session)
- Optimistic locking on session updates
- Proper logging (Winston for NestJS, built-in for FastAPI)
- Health check endpoints (/health for all services)
- Seed script for muscle groups, equipment, and sample exercises
- Input validation and error handling
- CORS configuration
- API versioning (v1 prefix)

---

## 📄 8️⃣ OUTPUT REQUIREMENTS

### Generate:

- Full folder scaffolding with Nx setup
- Complete Prisma schema with all models and relations
- NestJS modules with controllers, services, DTOs, guards
- FastAPI service with endpoints and Pydantic models
- React web app with components, hooks, routing
- Expo mobile app with screens and navigation
- Shared TypeScript types and utilities
- Dockerfiles and docker-compose.yml
- Environment configuration files
- Basic tests for each service
- README with setup, run, and deployment instructions
- nx.json and pnpm-workspace.yaml

Do not ask clarifying questions unless absolutely necessary for critical decisions.
Make reasonable defaults for all implementation details, but ensure the architecture is clean and scalable for future enhancements.

Generate:

- Full folder scaffolding
- Prisma schema
- NestJS modules
- FastAPI service
- Dockerfiles
- docker-compose.yml
- README with local run instructions

Ask clarifying questions only if a decision is blocking the implementation (e.g., set modeling strategy, auth approach). Otherwise, make reasonable defaults.
