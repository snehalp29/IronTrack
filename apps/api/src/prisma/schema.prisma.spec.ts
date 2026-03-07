import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Prisma schema hardening', () => {
  const prismaSchema = readFileSync(
    join(__dirname, '../../prisma/schema.prisma'),
    'utf8',
  );
  const latestMigration = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/202603060004_service_hardening/migration.sql',
    ),
    'utf8',
  );
  const sessionConstraintsMigration = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/202603060005_session_constraints/migration.sql',
    ),
    'utf8',
  );
  const nativeStringTypesMigration = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/202603060006_prisma_native_string_types/migration.sql',
    ),
    'utf8',
  );
  const boundedTextContractsMigration = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/202603060007_prisma_bounded_text_contracts/migration.sql',
    ),
    'utf8',
  );
  const serviceReviewMigration = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/202603060008_service_review_constraints/migration.sql',
    ),
    'utf8',
  );
  const backlogHardeningMigration = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/202603060009_service_backlog_hardening/migration.sql',
    ),
    'utf8',
  );

  it('uses bounded database types for user emails and refresh token hashes', () => {
    expect(prismaSchema).toContain(
      'email          String         @unique @db.VarChar(320)',
    );
    expect(prismaSchema).toContain('tokenHash String    @db.Char(64)');
  });

  it('adds a status-aware workout session index', () => {
    expect(prismaSchema).toContain('@@index([userId, status])');
  });

  it('enforces a database payload size limit for Set.payload', () => {
    expect(latestMigration).toContain('Set_payload_size_check');
    expect(latestMigration).toContain(
      'octet_length(("payload")::text) <= 4000',
    );
  });

  it('uses bounded database types for workout notes and template/exercise names', () => {
    expect(prismaSchema).toContain(
      'name                 String       @db.VarChar(120)',
    );
    expect(prismaSchema).toContain('name        String    @db.VarChar(120)');
    expect(prismaSchema).toContain(
      'notes             String?       @db.VarChar(4000)',
    );
  });

  it('adds a partial unique index for a single in-progress session per user', () => {
    expect(sessionConstraintsMigration).toContain(
      'WorkoutSession_single_in_progress_per_user',
    );
    expect(sessionConstraintsMigration).toContain(
      'WHERE status = \'IN_PROGRESS\' AND "deletedAt" IS NULL',
    );
  });

  it('uses explicit Prisma native types for remaining bounded string columns', () => {
    expect(prismaSchema).toContain(
      'passwordHash   String         @db.VarChar(255)',
    );
    expect(prismaSchema).toContain(
      'name           String?        @db.VarChar(120)',
    );
    expect(prismaSchema).toContain(
      'timezone       String?        @default("UTC") @db.VarChar(120)',
    );
    expect(prismaSchema).toContain(
      'googleId       String?        @unique @db.VarChar(255)',
    );
    expect(prismaSchema).toContain(
      'name      String   @unique @db.VarChar(120)',
    );
    expect(prismaSchema).toMatch(/avatarUrl\s+String\?\s+@db\.VarChar\(2048\)/);
    expect(prismaSchema).toMatch(/imageUrl\s+String\?\s+@db\.VarChar\(2048\)/);
    expect(prismaSchema).toMatch(/iconUrl\s+String\?\s+@db\.VarChar\(2048\)/);
    expect(prismaSchema).toMatch(/url\s+String\s+@db\.VarChar\(2048\)/);
    expect(prismaSchema).toContain(
      'title              String?       @db.VarChar(255)',
    );
    expect(prismaSchema).toMatch(
      /thumbnailUrl\s+String\?\s+@db\.VarChar\(2048\)/,
    );
    expect(prismaSchema).toContain(
      'supersetGroupKey   String?   @db.VarChar(64)',
    );
    expect(prismaSchema).toContain(
      'idempotencyKey    String?      @db.VarChar(128)',
    );
  });

  it('adds migration coverage for the newly typed Prisma string columns', () => {
    expect(nativeStringTypesMigration).toContain(
      'ALTER TABLE "User"\nALTER COLUMN "passwordHash" TYPE VARCHAR(255);',
    );
    expect(nativeStringTypesMigration).toContain(
      'ALTER TABLE "WorkoutTemplateExercise"\nALTER COLUMN "supersetGroupKey" TYPE VARCHAR(64);',
    );
    expect(nativeStringTypesMigration).toContain(
      'ALTER TABLE "Set"\nALTER COLUMN "idempotencyKey" TYPE VARCHAR(128);',
    );
  });

  it('uses bounded database types for text fields already capped in the API contract', () => {
    expect(prismaSchema).toContain(
      'description          String?      @db.VarChar(4000)',
    );
    expect(prismaSchema).toContain(
      'defaultCues          String?      @db.VarChar(4000)',
    );
    expect(prismaSchema).toContain('description String?   @db.VarChar(4000)');
    expect(prismaSchema).toContain(
      'notes              String?   @db.VarChar(4000)',
    );
    expect(prismaSchema).toContain(
      'note               String   @db.VarChar(4000)',
    );
    expect(prismaSchema).toContain('note      String   @db.VarChar(4000)');
  });

  it('adds migration coverage for bounded text contract columns', () => {
    expect(boundedTextContractsMigration).toContain(
      'ALTER TABLE "ExerciseTemplate"\nALTER COLUMN "description" TYPE VARCHAR(4000);',
    );
    expect(boundedTextContractsMigration).toContain(
      'ALTER TABLE "SessionExercise"\nALTER COLUMN "notes" TYPE VARCHAR(4000);',
    );
    expect(boundedTextContractsMigration).toContain(
      'ALTER TABLE "ExerciseNote"\nALTER COLUMN "note" TYPE VARCHAR(4000);',
    );
  });

  it('adds an index for set completion lookups', () => {
    expect(prismaSchema).toContain('@@index([completedAt])');
    expect(serviceReviewMigration).toContain(
      'CREATE INDEX "Set_completedAt_idx" ON "Set"("completedAt");',
    );
  });

  it('adds a ghost-exercise check constraint', () => {
    expect(serviceReviewMigration).toContain(
      'ExerciseTemplate_owner_or_global_check',
    );
    expect(serviceReviewMigration).toContain(
      'CHECK ("isGlobal" = true OR "ownerUserId" IS NOT NULL)',
    );
  });

  it('cascades private exercise ownership deletes so the owner/global check stays satisfiable', () => {
    expect(backlogHardeningMigration).toContain(
      'ALTER TABLE "ExerciseTemplate" DROP CONSTRAINT "ExerciseTemplate_ownerUserId_fkey";',
    );
    expect(backlogHardeningMigration).toContain(
      'ADD CONSTRAINT "ExerciseTemplate_ownerUserId_fkey"',
    );
    expect(backlogHardeningMigration).toContain(
      'FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
  });

  it('adds backlog schema indexes and audit columns for sessions, PRs, streaks, and refresh tokens', () => {
    expect(prismaSchema).toContain('@@index([expiresAt])');
    expect(prismaSchema).toContain('@@index([userId, finishedAt])');
    expect(prismaSchema).toContain('@@index([exerciseTemplateId])');
    expect(prismaSchema).toMatch(
      /model PRRecord[\s\S]*createdAt\s+DateTime\s+@default\(now\(\)\)/,
    );
    expect(prismaSchema).toMatch(
      /model PRRecord[\s\S]*updatedAt\s+DateTime\s+@updatedAt/,
    );
    expect(prismaSchema).toContain('@@index([userId, achievedAt])');
    expect(prismaSchema).toContain('@@index([sessionId])');
    expect(prismaSchema).toContain('@@index([setId])');
    expect(prismaSchema).toMatch(
      /model UserStreak[\s\S]*updatedAt\s+DateTime\s+@updatedAt/,
    );
    expect(prismaSchema).toMatch(
      /model ChecklistItem[\s\S]*updatedAt\s+DateTime\s+@updatedAt/,
    );
    expect(prismaSchema).toContain('@@index([deletedAt])');
  });

  it('adds migration coverage for backlog unique indexes and constraint hardening', () => {
    expect(backlogHardeningMigration).toContain(
      'WorkoutTemplate_userId_orderIndex_active_key',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutTemplate_userId_lower_name_active_key',
    );
    expect(backlogHardeningMigration).toContain(
      'ExerciseVideo_exerciseTemplateId_primary_key',
    );
    expect(backlogHardeningMigration).toContain('RefreshToken_expiresAt_idx');
    expect(backlogHardeningMigration).toContain(
      'WorkoutSession_userId_finishedAt_idx',
    );
    expect(backlogHardeningMigration).toContain(
      'PRRecord_userId_achievedAt_idx',
    );
    expect(backlogHardeningMigration).toContain('PRRecord_sessionId_idx');
    expect(backlogHardeningMigration).toContain('PRRecord_setId_idx');
    expect(backlogHardeningMigration).toContain('Set_rpe_range_check');
    expect(backlogHardeningMigration).toContain(
      'Set_durationSeconds_nonnegative_check',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutSession_totalVolume_nonnegative_check',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutTemplate_orderIndex_nonnegative_check',
    );
    expect(backlogHardeningMigration).toContain(
      'PRRecord_value_positive_check',
    );
    expect(backlogHardeningMigration).toContain('UserStreak_invariants_check');
    expect(backlogHardeningMigration).toContain(
      'WorkoutSession_version_positive_check',
    );
    expect(backlogHardeningMigration).toContain(
      'SessionExercise_version_positive_check',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutSession_status_endedReason_check',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutSession_finishedAt_after_startedAt_check',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutSession_startedAt_not_future_check',
    );
  });

  it('deduplicates legacy refresh token hashes before creating the unique index', () => {
    const refreshTokenMigration = readFileSync(
      join(
        __dirname,
        '../../prisma/migrations/202603050003_refresh_token_hash_unique/migration.sql',
      ),
      'utf8',
    );

    expect(refreshTokenMigration).toContain('ROW_NUMBER() OVER');
    expect(refreshTokenMigration).toContain('PARTITION BY "tokenHash"');
    expect(refreshTokenMigration).toContain('DELETE FROM "RefreshToken"');
    expect(refreshTokenMigration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key"',
    );
  });

  it('adds migration coverage for backlog URL column bounds and new audit timestamps', () => {
    expect(backlogHardeningMigration).toContain(
      'ALTER TABLE "User"\nALTER COLUMN "avatarUrl" TYPE VARCHAR(2048);',
    );
    expect(backlogHardeningMigration).toContain(
      'ALTER TABLE "ExerciseVideo"\nALTER COLUMN "url" TYPE VARCHAR(2048);',
    );
    expect(backlogHardeningMigration).toContain(
      'ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
    expect(backlogHardeningMigration).toContain(
      'ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
  });

  it('adds migration coverage for deleted-row indexes and remaining non-negative constraints', () => {
    expect(backlogHardeningMigration).toContain('User_deletedAt_idx');
    expect(backlogHardeningMigration).toContain(
      'ExerciseTemplate_deletedAt_idx',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutTemplate_deletedAt_idx',
    );
    expect(backlogHardeningMigration).toContain('WorkoutSession_deletedAt_idx');
    expect(backlogHardeningMigration).toContain(
      'SessionExercise_deletedAt_idx',
    );
    expect(backlogHardeningMigration).toContain('Set_deletedAt_idx');
    expect(backlogHardeningMigration).toContain('Set_weight_nonnegative_check');
    expect(backlogHardeningMigration).toContain('Set_reps_nonnegative_check');
    expect(backlogHardeningMigration).toContain(
      'Set_orderIndex_nonnegative_check',
    );
    expect(backlogHardeningMigration).toContain(
      'WorkoutTemplateExercise_orderIndex_nonnegative_check',
    );
    expect(backlogHardeningMigration).toContain(
      'SessionExercise_orderIndex_nonnegative_check',
    );
  });
});
