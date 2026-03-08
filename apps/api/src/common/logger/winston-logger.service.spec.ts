import { WinstonLoggerService } from './winston-logger.service';

describe('WinstonLoggerService', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const createService = () => {
    const service = new WinstonLoggerService();
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      fatal: jest.fn(),
    };

    (service as never as { logger: typeof logger }).logger = logger;

    return { service, logger };
  };

  it('logs string message with context', () => {
    const { service, logger } = createService();

    service.log('hello', 'Auth');

    expect(logger.info).toHaveBeenCalledWith('hello', {
      context: 'Auth',
      details: undefined,
    });
  });

  it('formats error objects with details', () => {
    const { service, logger } = createService();

    const error = new Error('db failed');
    service.error(error, 'trace-line', 'Db');

    expect(logger.error).toHaveBeenCalledWith('db failed', {
      trace: 'trace-line',
      context: 'Db',
      details: {
        name: 'Error',
      },
      stack: 'trace-line',
    });
  });

  it('formats non-string message payloads', () => {
    const { service, logger } = createService();

    service.warn({ foo: 'bar' }, 'Ctx');
    service.debug({ foo: 'bar' }, 'Ctx');
    service.verbose({ foo: 'bar' }, 'Ctx');

    expect(logger.warn).toHaveBeenCalledWith('Non-string log message', {
      context: 'Ctx',
      details: { foo: 'bar' },
    });
    expect(logger.debug).toHaveBeenCalledWith('Non-string log message', {
      context: 'Ctx',
      details: { foo: 'bar' },
    });
    expect(logger.verbose).toHaveBeenCalledWith('Non-string log message', {
      context: 'Ctx',
      details: { foo: 'bar' },
    });
  });

  it('uses info log level in production mode', () => {
    process.env.NODE_ENV = 'production';
    const service = new WinstonLoggerService() as unknown as {
      logger: { level: string };
    };

    expect(service.logger.level).toBe('info');
  });

  it('normalizes validated NODE_ENV values before deriving log level', () => {
    process.env.NODE_ENV = ' production ';
    const service = new WinstonLoggerService() as unknown as {
      logger: { level: string };
    };

    expect(service.logger.level).toBe('info');
  });

  it('logs error stacks under a top-level stack field', () => {
    const { service, logger } = createService();

    const error = new Error('db failed');
    service.error(error, undefined, 'Db');

    expect(logger.error).toHaveBeenCalledWith('db failed', {
      context: 'Db',
      details: {
        name: 'Error',
      },
      stack: expect.any(String),
      trace: undefined,
    });
  });

  it('routes fatal logs through the error transport with a fatal marker', () => {
    const { service, logger } = createService();
    const fatal = service as unknown as {
      fatal: (message: unknown, context?: string) => void;
    };

    fatal.fatal('catastrophic failure', 'Bootstrap');

    expect(logger.error).toHaveBeenCalledWith('catastrophic failure', {
      context: 'Bootstrap',
      details: undefined,
      fatal: true,
    });
  });

  it('defaults to debug logging when NODE_ENV is invalid', () => {
    process.env.NODE_ENV = 'qa';
    const service = new WinstonLoggerService() as unknown as {
      logger: { level: string };
    };

    expect(service.logger.level).toBe('debug');
  });
});
