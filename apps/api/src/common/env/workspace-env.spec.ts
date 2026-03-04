import {
  loadEnvFiles,
  loadWorkspaceEnv,
  requireDatabaseUrl,
  resolveDatabaseUrl,
} from './workspace-env';

describe('workspace env loader', () => {
  it('loads env files in order and ignores missing files', () => {
    const loadEnvFile = jest
      .fn()
      .mockImplementationOnce(() => {
        const error = new Error('missing') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      })
      .mockImplementationOnce(() => undefined);

    loadEnvFiles(['.env', '../../.env'], { loadEnvFile });

    expect(loadEnvFile).toHaveBeenNthCalledWith(1, '.env');
    expect(loadEnvFile).toHaveBeenNthCalledWith(2, '../../.env');
  });

  it('rethrows unexpected file loading errors', () => {
    const loadEnvFile = jest.fn(() => {
      throw new Error('boom');
    });

    expect(() => loadEnvFiles(['.env'], { loadEnvFile })).toThrow('boom');
  });

  it('no-ops when process.loadEnvFile is unavailable', () => {
    const original = process.loadEnvFile;
    try {
      Object.defineProperty(process, 'loadEnvFile', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      expect(() => loadEnvFiles(['.env'])).not.toThrow();
    } finally {
      Object.defineProperty(process, 'loadEnvFile', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });

  it('delegates dotenv parsing to process.loadEnvFile when available', () => {
    const original = process.loadEnvFile;
    const loadEnvFile = jest.fn();
    try {
      Object.defineProperty(process, 'loadEnvFile', {
        value: loadEnvFile,
        configurable: true,
        writable: true,
      });

      loadEnvFiles(['/tmp/.env']);

      expect(loadEnvFile).toHaveBeenCalledWith('/tmp/.env');
    } finally {
      Object.defineProperty(process, 'loadEnvFile', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });

  it('loads workspace env files from current working directory', () => {
    const loadEnvFile = jest.fn();

    loadWorkspaceEnv({ cwd: '/repo/apps/api', loadEnvFile });

    expect(loadEnvFile).toHaveBeenNthCalledWith(1, '/repo/apps/api/.env');
    expect(loadEnvFile).toHaveBeenNthCalledWith(2, '/repo/.env');
  });

  it('uses process cwd and process loader when options are omitted', () => {
    const originalLoadEnvFile = process.loadEnvFile;
    const loadEnvFile = jest.fn();
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/repo/apps/api');

    try {
      Object.defineProperty(process, 'loadEnvFile', {
        value: loadEnvFile,
        configurable: true,
        writable: true,
      });

      loadWorkspaceEnv();

      expect(loadEnvFile).toHaveBeenNthCalledWith(1, '/repo/apps/api/.env');
      expect(loadEnvFile).toHaveBeenNthCalledWith(2, '/repo/.env');
    } finally {
      cwdSpy.mockRestore();
      Object.defineProperty(process, 'loadEnvFile', {
        value: originalLoadEnvFile,
        configurable: true,
        writable: true,
      });
    }
  });

  it('resolves non-empty DATABASE_URL values', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgres://db-url  ' })).toBe(
      'postgres://db-url',
    );
    expect(resolveDatabaseUrl({ DATABASE_URL: '   ' })).toBeUndefined();
  });

  it('reads DATABASE_URL from process.env by default', () => {
    const original = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgres://from-env';
      expect(resolveDatabaseUrl()).toBe('postgres://from-env');
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  it('requires a non-empty DATABASE_URL for prisma datasource config', () => {
    expect(requireDatabaseUrl({ DATABASE_URL: ' postgresql://db-url ' })).toBe(
      'postgresql://db-url',
    );

    expect(() => requireDatabaseUrl({ DATABASE_URL: '   ' })).toThrow(
      'DATABASE_URL is required for Prisma datasource configuration.',
    );
    expect(() => requireDatabaseUrl({})).toThrow(
      'DATABASE_URL is required for Prisma datasource configuration.',
    );
  });

  it('supports custom required DATABASE_URL error messages', () => {
    expect(() =>
      requireDatabaseUrl(
        { DATABASE_URL: '   ' },
        'DATABASE_URL is required to initialize Prisma.',
      ),
    ).toThrow('DATABASE_URL is required to initialize Prisma.');
  });

  it('reads DATABASE_URL from process.env by default when requiring datasource url', () => {
    const original = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = '  postgresql://from-env  ';
      expect(requireDatabaseUrl()).toBe('postgresql://from-env');
    } finally {
      process.env.DATABASE_URL = original;
    }
  });
});
