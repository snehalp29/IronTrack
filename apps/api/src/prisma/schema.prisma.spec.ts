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
    expect(prismaSchema).toContain('url                String        @db.Text');
    expect(prismaSchema).toContain(
      'title              String?       @db.VarChar(255)',
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
});
