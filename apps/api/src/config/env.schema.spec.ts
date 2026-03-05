import { validateEnv } from './env.schema';

const VALID_DATABASE_URL =
  'postgresql://user:password@db.example.com:5432/mydb';
const VALID_ACCESS_SECRET = 'access-secret-for-testing-only';
const VALID_REFRESH_SECRET = 'refresh-secret-for-testing-only';
const VALID_GOOGLE_CLIENT_ID = 'google-client-id';
const VALID_GOOGLE_CLIENT_SECRET = 'google-client-secret';
const VALID_GOOGLE_CALLBACK_URL =
  'https://api.example.com/api/v1/auth/google/callback';

function createBaseConfig(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    DATABASE_URL: VALID_DATABASE_URL,
    JWT_ACCESS_SECRET: VALID_ACCESS_SECRET,
    JWT_REFRESH_SECRET: VALID_REFRESH_SECRET,
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('parses valid config and applies defaults', () => {
    const parsed = validateEnv(createBaseConfig());

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.API_PORT).toBe(3000);
    expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('7d');
    expect(parsed.ML_SERVICE_URL).toBe('http://localhost:5000');
  });

  it('normalizes whitespace for DATABASE_URL and API_PREFIX', () => {
    const parsed = validateEnv(
      createBaseConfig({
        DATABASE_URL: '  postgresql://user:password@db.example.com:5432/mydb  ',
        API_PREFIX: '  /api/v2/  ',
        JWT_ACCESS_SECRET: '  access-secret-for-testing-only  ',
        JWT_REFRESH_SECRET: '  refresh-secret-for-testing-only  ',
      }),
    );

    expect(parsed.DATABASE_URL).toBe(VALID_DATABASE_URL);
    expect(parsed.API_PREFIX).toBe('/api/v2/');
    expect(parsed.JWT_ACCESS_SECRET).toBe(VALID_ACCESS_SECRET);
    expect(parsed.JWT_REFRESH_SECRET).toBe(VALID_REFRESH_SECRET);
  });

  it('falls back to defaults when API_PREFIX or CORS_ORIGINS are blank strings', () => {
    const parsed = validateEnv(
      createBaseConfig({
        API_PREFIX: '   ',
        CORS_ORIGINS: '\n\t',
      }),
    );

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
      validateEnv(
        createBaseConfig({
          DATABASE_URL: 'https://db.example.com',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: DATABASE_URL: Expected DATABASE_URL to start with postgres:\/\/ or postgresql:\/\//,
    );
  });

  it('rejects non-string DATABASE_URL values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          DATABASE_URL: 123,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: DATABASE_URL: Invalid input: expected string, received number/,
    );
  });

  it('accepts duration values with surrounding whitespace and normalizes them', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: ' 15m ',
        JWT_REFRESH_EXPIRY: '\t7d\n',
      }),
    );

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('7d');
  });

  it('rejects non-positive JWT duration values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_ACCESS_EXPIRY: '0m',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_ACCESS_EXPIRY: Expected positive duration format like 15m, 7d, 30s, or 2h/,
    );

    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_REFRESH_EXPIRY: '0d',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_REFRESH_EXPIRY: Expected positive duration format like 15m, 7d, 30s, or 2h/,
    );
  });

  it('coerces API_PORT string values into numbers', () => {
    const parsed = validateEnv(
      createBaseConfig({
        API_PORT: '8080',
      }),
    );

    expect(parsed.API_PORT).toBe(8080);
  });

  it('rejects zero API_PORT values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          API_PORT: 0,
        }),
      ),
    ).toThrow(/Invalid environment configuration: API_PORT:/);
  });

  it('rejects negative API_PORT values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          API_PORT: -1,
        }),
      ),
    ).toThrow(/Invalid environment configuration: API_PORT:/);
  });

  it('rejects non-numeric API_PORT values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          API_PORT: 'abc',
        }),
      ),
    ).toThrow(/Invalid environment configuration: API_PORT:/);
  });

  it('rejects non-integer API_PORT values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          API_PORT: '8080.5',
        }),
      ),
    ).toThrow(/Invalid environment configuration: API_PORT:/);
  });

  it('requires complete Google OAuth config in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required when NODE_ENV=production, GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET is required when NODE_ENV=production, GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL is required when NODE_ENV=production/,
    );
  });

  it('reports only missing Google OAuth fields in production when partially configured', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL is required when NODE_ENV=production/,
    );
  });

  it('reports missing client id in production when secret and callback are provided', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required when NODE_ENV=production/,
    );
  });

  it('rejects partial Google OAuth config outside production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'development',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL, GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must be provided with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
    );
  });

  it('rejects non-production Google OAuth config when client id is missing', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'development',
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID must be provided with GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL/,
    );
  });

  it('accepts complete Google OAuth config in production', () => {
    const parsed = validateEnv(
      createBaseConfig({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        ML_SERVICE_URL: 'https://ml.example.com',
      }),
    );

    expect(parsed.GOOGLE_CLIENT_ID).toBe(VALID_GOOGLE_CLIENT_ID);
    expect(parsed.GOOGLE_CLIENT_SECRET).toBe(VALID_GOOGLE_CLIENT_SECRET);
    expect(parsed.GOOGLE_CALLBACK_URL).toBe(VALID_GOOGLE_CALLBACK_URL);
  });

  it('treats blank Google OAuth values as missing', () => {
    const parsed = validateEnv(
      createBaseConfig({
        NODE_ENV: 'development',
        GOOGLE_CLIENT_ID: '   ',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_CALLBACK_URL: '\n\t',
      }),
    );

    expect(parsed.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(parsed.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(parsed.GOOGLE_CALLBACK_URL).toBeUndefined();
  });

  it('rejects non-string Google OAuth values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          GOOGLE_CLIENT_ID: 123,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: Invalid input: expected string, received number/,
    );

    expect(() =>
      validateEnv(
        createBaseConfig({
          GOOGLE_CALLBACK_URL: 123,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: Invalid input: expected string, received number/,
    );
  });

  it('rejects short GOOGLE_CLIENT_SECRET values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: 'short',
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_SECRET: Too small: expected string to have >=10 characters/,
    );
  });

  it('rejects invalid CORS_ORIGINS values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'http//localhost:3000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS must be a comma-separated list of valid HTTP\(S\) origins/,
    );
  });

  it('rejects CORS_ORIGINS values with non-http protocols', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'ftp://app.example.com',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS must be a comma-separated list of valid HTTP\(S\) origins/,
    );
  });

  it('normalizes whitespace in CORS_ORIGINS values', () => {
    const parsed = validateEnv(
      createBaseConfig({
        CORS_ORIGINS:
          ' https://app.example.com , http://localhost:3000 , https://admin.example.com ',
      }),
    );

    expect(parsed.CORS_ORIGINS).toBe(
      'https://app.example.com,http://localhost:3000,https://admin.example.com',
    );
  });

  it('rejects invalid ML_SERVICE_URL values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          ML_SERVICE_URL: 'not-a-url',
        }),
      ),
    ).toThrow(/Invalid environment configuration: ML_SERVICE_URL: Invalid URL/);
  });

  it('rejects non-https ML_SERVICE_URL values in production when explicitly set', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
          ML_SERVICE_URL: 'http://ml.internal:5000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: ML_SERVICE_URL: ML_SERVICE_URL must use https when NODE_ENV=production/,
    );
  });

  it('formats root-level validation errors with an explicit root path', () => {
    expect(() =>
      validateEnv('invalid-config' as unknown as Record<string, unknown>),
    ).toThrow(
      /Invalid environment configuration: <root>: Invalid input: expected object, received string/,
    );
  });
});
