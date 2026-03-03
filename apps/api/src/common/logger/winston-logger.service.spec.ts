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
      details: expect.objectContaining({
        name: 'Error',
        stack: expect.any(String),
      }),
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
});
