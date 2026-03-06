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
});
