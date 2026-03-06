import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { createRequire } from 'node:module';

jest.mock('@nestjs/core', () => ({
  ...jest.requireActual('@nestjs/core'),
  NestFactory: {
    create: jest.fn(),
  },
}));

jest.mock('@nestjs/swagger', () => {
  class MockDocumentBuilder {
    setTitle() {
      return this;
    }

    setDescription() {
      return this;
    }

    setVersion() {
      return this;
    }

    addBearerAuth() {
      return this;
    }

    build() {
      return { openapi: '3.0.0' };
    }
  }

  return {
    DocumentBuilder: MockDocumentBuilder,
    SwaggerModule: {
      createDocument: jest.fn().mockReturnValue({ openapi: '3.0.0' }),
      setup: jest.fn(),
    },
  };
});

jest.mock('cookie-parser', () => ({
  __esModule: true,
  default: jest.fn(() => 'cookie-parser-middleware'),
}));

jest.mock('helmet', () => ({
  __esModule: true,
  default: jest.fn(() => 'helmet-middleware'),
}));

jest.mock('./common/logger/winston-logger.service', () => ({
  WinstonLoggerService: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  })),
}));

const localRequire = createRequire(__filename);

describe('bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createAppMocks(
    nodeEnv: 'development' | 'production' = 'development',
  ) {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'API_PREFIX':
            return 'api/v1';
          case 'CORS_ORIGINS':
            return ['https://app.example.com'];
          case 'API_PORT':
            return 3000;
          case 'NODE_ENV':
            return nodeEnv;
          default:
            throw new Error(`Unexpected config key: ${key}`);
        }
      }),
    };

    const prismaService = {
      enableShutdownHooks: jest.fn().mockResolvedValue(undefined),
    };

    const app = {
      use: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalFilters: jest.fn(),
      setGlobalPrefix: jest.fn(),
      enableCors: jest.fn(),
      get: jest.fn((token: unknown) => {
        const tokenName =
          typeof token === 'function'
            ? token.name
            : (token as { name?: string })?.name;
        if (tokenName === 'ConfigService') {
          return configService;
        }
        if (tokenName === 'PrismaService') {
          return prismaService;
        }
        throw new Error(`Unexpected provider: ${String(token)}`);
      }),
      listen: jest.fn().mockResolvedValue(undefined),
    };

    return { app, configService, prismaService };
  }

  function loadMainModule() {
    let mainModule: typeof import('./main.js') | undefined;
    jest.isolateModules(() => {
      mainModule = localRequire('./main') as typeof import('./main.js');
    });
    return mainModule!;
  }

  it('does not auto-bootstrap when the module is imported', () => {
    const { app } = createAppMocks();
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    loadMainModule();

    expect(NestFactory.create).not.toHaveBeenCalled();
  });

  it('skips swagger setup in production', async () => {
    const { app, prismaService } = createAppMocks('production');
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    const { bootstrap } = loadMainModule();

    await bootstrap();

    expect(prismaService.enableShutdownHooks).toHaveBeenCalledWith(app);
    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();
    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });

  it('registers swagger docs outside production', async () => {
    const { app, prismaService } = createAppMocks('development');
    (NestFactory.create as jest.Mock).mockResolvedValue(app);

    const { bootstrap } = loadMainModule();

    await bootstrap();

    expect(prismaService.enableShutdownHooks).toHaveBeenCalledWith(app);
    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(
      app,
      expect.any(Object),
    );
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'api/v1/docs',
      app,
      expect.objectContaining({ openapi: '3.0.0' }),
    );
  });
});
