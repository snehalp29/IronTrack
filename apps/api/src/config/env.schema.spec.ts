import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('parses valid config and applies defaults', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
      JWT_ACCESS_SECRET: '1234567890abcdef',
      JWT_REFRESH_SECRET: '1234567890abcdef',
    });

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.API_PORT).toBe(3000);
    expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('7d');
    expect(parsed.ML_SERVICE_URL).toBe('http://localhost:5000');
  });

  it('normalizes whitespace for DATABASE_URL and API_PREFIX', () => {
    const parsed = validateEnv({
      DATABASE_URL: '  postgresql://user:password@db.example.com:5432/mydb  ',
      API_PREFIX: '  /api/v2/  ',
      JWT_ACCESS_SECRET: '1234567890abcdef',
      JWT_REFRESH_SECRET: '1234567890abcdef',
    });

    expect(parsed.DATABASE_URL).toBe(
      'postgresql://user:password@db.example.com:5432/mydb',
    );
    expect(parsed.API_PREFIX).toBe('/api/v2/');
  });

  it('falls back to defaults when API_PREFIX or CORS_ORIGINS are blank strings', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
      API_PREFIX: '   ',
      CORS_ORIGINS: '\n\t',
      JWT_ACCESS_SECRET: '1234567890abcdef',
      JWT_REFRESH_SECRET: '1234567890abcdef',
    });

    expect(parsed.API_PREFIX).toBe('api/v1');
    expect(parsed.CORS_ORIGINS).toBe(
      'http://localhost:3000,http://localhost:5173,http://localhost:8081',
    );
  });

  it('throws with issue details for invalid values', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'not-a-url',
        JWT_ACCESS_SECRET: 'short',
        JWT_REFRESH_SECRET: 'short',
      }),
    ).toThrow(
      /Invalid environment configuration: DATABASE_URL: Invalid URL, JWT_ACCESS_SECRET: Too small: expected string to have >=16 characters, JWT_REFRESH_SECRET: Too small: expected string to have >=16 characters/,
    );
  });

  it('rejects non-postgres database URLs', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'https://db.example.com',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
      }),
    ).toThrow(
      /Invalid environment configuration: DATABASE_URL: Expected DATABASE_URL to start with postgres:\/\/ or postgresql:\/\//,
    );
  });

  it('rejects non-string DATABASE_URL values', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 123,
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
      }),
    ).toThrow(
      /Invalid environment configuration: DATABASE_URL: Invalid input: expected string, received number/,
    );
  });

  it('accepts duration values with surrounding whitespace and normalizes them', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
      JWT_ACCESS_SECRET: '1234567890abcdef',
      JWT_REFRESH_SECRET: '1234567890abcdef',
      JWT_ACCESS_EXPIRY: ' 15m ',
      JWT_REFRESH_EXPIRY: '\t7d\n',
    });

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('7d');
  });

  it('rejects non-positive JWT duration values', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        JWT_ACCESS_EXPIRY: '0m',
      }),
    ).toThrow(
      /Invalid environment configuration: JWT_ACCESS_EXPIRY: Expected positive duration format like 15m, 7d, 30s, or 2h/,
    );

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        JWT_REFRESH_EXPIRY: '0d',
      }),
    ).toThrow(
      /Invalid environment configuration: JWT_REFRESH_EXPIRY: Expected positive duration format like 15m, 7d, 30s, or 2h/,
    );
  });

  it('requires complete Google OAuth config in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
      }),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required when NODE_ENV=production, GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET is required when NODE_ENV=production, GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL is required when NODE_ENV=production/,
    );
  });

  it('reports only missing Google OAuth fields in production when partially configured', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
      }),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL is required when NODE_ENV=production/,
    );
  });

  it('reports missing client id in production when secret and callback are provided', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        GOOGLE_CALLBACK_URL:
          'https://api.example.com/api/v1/auth/google/callback',
      }),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required when NODE_ENV=production/,
    );
  });

  it('rejects partial Google OAuth config outside production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        GOOGLE_CLIENT_ID: 'google-client-id',
      }),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL, GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must be provided with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
    );
  });

  it('rejects non-production Google OAuth config when client id is missing', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        GOOGLE_CALLBACK_URL:
          'https://api.example.com/api/v1/auth/google/callback',
      }),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID must be provided with GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL/,
    );
  });

  it('accepts complete Google OAuth config in production', () => {
    const parsed = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
      JWT_ACCESS_SECRET: '1234567890abcdef',
      JWT_REFRESH_SECRET: '1234567890abcdef',
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_CALLBACK_URL:
        'https://api.example.com/api/v1/auth/google/callback',
    });

    expect(parsed.GOOGLE_CLIENT_ID).toBe('google-client-id');
    expect(parsed.GOOGLE_CLIENT_SECRET).toBe('google-client-secret');
    expect(parsed.GOOGLE_CALLBACK_URL).toBe(
      'https://api.example.com/api/v1/auth/google/callback',
    );
  });

  it('treats blank Google OAuth values as missing', () => {
    const parsed = validateEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
      JWT_ACCESS_SECRET: '1234567890abcdef',
      JWT_REFRESH_SECRET: '1234567890abcdef',
      GOOGLE_CLIENT_ID: '   ',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_CALLBACK_URL: '\n\t',
    });

    expect(parsed.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(parsed.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(parsed.GOOGLE_CALLBACK_URL).toBeUndefined();
  });

  it('rejects non-string Google OAuth values', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        GOOGLE_CLIENT_ID: 123,
      }),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: Invalid input: expected string, received number/,
    );

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/mydb',
        JWT_ACCESS_SECRET: '1234567890abcdef',
        JWT_REFRESH_SECRET: '1234567890abcdef',
        GOOGLE_CALLBACK_URL: 123,
      }),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: Invalid input: expected string, received number/,
    );
  });
});
