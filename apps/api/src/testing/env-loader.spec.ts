import { loadEnvForJest } from './env-loader';

describe('loadEnvForJest', () => {
  it('loads .env.test first and then .env in test mode', () => {
    const loadEnvFile = jest.fn();

    loadEnvForJest({
      nodeEnv: 'test',
      loadEnvFile,
    });

    expect(loadEnvFile).toHaveBeenNthCalledWith(1, '.env.test');
    expect(loadEnvFile).toHaveBeenNthCalledWith(2, '.env');
    expect(loadEnvFile).toHaveBeenCalledTimes(2);
  });

  it('falls back to .env when .env.test is missing', () => {
    const loadEnvFile = jest
      .fn()
      .mockImplementationOnce(() => {
        const error = new Error('missing') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      })
      .mockImplementationOnce(() => undefined);

    loadEnvForJest({
      nodeEnv: 'test',
      loadEnvFile,
    });

    expect(loadEnvFile).toHaveBeenNthCalledWith(1, '.env.test');
    expect(loadEnvFile).toHaveBeenNthCalledWith(2, '.env');
    expect(loadEnvFile).toHaveBeenCalledTimes(2);
  });

  it('loads only .env outside test mode', () => {
    const loadEnvFile = jest.fn();

    loadEnvForJest({
      nodeEnv: 'development',
      loadEnvFile,
    });

    expect(loadEnvFile).toHaveBeenCalledWith('.env');
    expect(loadEnvFile).toHaveBeenCalledTimes(1);
  });

  it('rethrows unexpected load errors', () => {
    const loadEnvFile = jest.fn(() => {
      throw new Error('boom');
    });

    expect(() =>
      loadEnvForJest({
        nodeEnv: 'test',
        loadEnvFile,
      }),
    ).toThrow('boom');
  });

  it('no-ops when process.loadEnvFile is unavailable', () => {
    const original = process.loadEnvFile;
    const define = Object.defineProperty;
    try {
      define(process, 'loadEnvFile', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      expect(() =>
        loadEnvForJest({
          nodeEnv: 'test',
        }),
      ).not.toThrow();
    } finally {
      define(process, 'loadEnvFile', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
