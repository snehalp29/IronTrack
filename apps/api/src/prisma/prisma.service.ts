import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { requireDatabaseUrl } from '../common/env/workspace-env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private shutdownHookRegistered = false;

  constructor() {
    const connectionString = requireDatabaseUrl(
      process.env,
      'DATABASE_URL is required to initialize Prisma.',
    );

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    if (this.shutdownHookRegistered) {
      return;
    }

    let closePromise: Promise<void> | null = null;
    const shutdown = async () => {
      if (!closePromise) {
        closePromise = app.close();
      }
      await closePromise;
    };

    process.once('beforeExit', shutdown);
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    this.shutdownHookRegistered = true;
  }
}
