import type { INestApplication } from '@nestjs/common';

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    jest.restoreAllMocks();
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    expect(() => new PrismaService()).toThrow(
      'DATABASE_URL is required to initialize Prisma.',
    );
  });

  it('connects on module init', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as never);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('registers beforeExit hook to close app', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    const service = new PrismaService();
    const app = {
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as INestApplication;

    let beforeExitHandler: (() => Promise<void>) | undefined;
    const onSpy = jest.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: () => Promise<void>,
    ) => {
      if (event === 'beforeExit') {
        beforeExitHandler = handler;
      }
      return process;
    }) as never);

    await service.enableShutdownHooks(app);
    expect(onSpy).toHaveBeenCalled();

    await beforeExitHandler?.();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('registers beforeExit shutdown hook only once', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    const service = new PrismaService();
    const app = {
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as INestApplication;

    let beforeExitHandler: (() => Promise<void>) | undefined;
    const onceSpy = jest.spyOn(process, 'once').mockImplementation(((
      event: string,
      handler: () => Promise<void>,
    ) => {
      if (event === 'beforeExit') {
        beforeExitHandler = handler;
      }
      return process;
    }) as never);

    await service.enableShutdownHooks(app);
    await service.enableShutdownHooks(app);

    expect(onceSpy).toHaveBeenCalledTimes(1);

    await beforeExitHandler?.();
    expect(app.close).toHaveBeenCalledTimes(1);
  });
});
