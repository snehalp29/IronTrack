import {
  durationToSeconds,
  isValidCorsOrigin,
  validateEnv,
} from './env.schema';

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

function getValidationErrorMessage(config: Record<string, unknown>): string {
  return getValidationErrorMessageFrom(config, validateEnv);
}

function getValidationErrorMessageFrom(
  config: Record<string, unknown>,
  validator: (input: Record<string, unknown>) => unknown,
): string {
  try {
    validator(config);
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return `validateEnv threw a non-Error: ${String(error)}`;
  }
  throw new Error('Expected validateEnv to throw');
}

describe('validateEnv', () => {
  it('parses valid config and applies defaults', () => {
    const parsed = validateEnv(createBaseConfig());

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.API_PORT).toBe(3000);
    expect(parsed.API_PREFIX).toBe('api/v1');
    expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('7d');
    expect(parsed.ML_SERVICE_URL).toBe('http://localhost:5000');
    expect(parsed.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
  });

  it('formats non-Error throws in the test helper', () => {
    const message = getValidationErrorMessageFrom(createBaseConfig(), () => {
      throw 'boom';
    });

    expect(message).toBe('validateEnv threw a non-Error: boom');
  });

  it('converts duration strings to seconds', () => {
    expect(durationToSeconds('30s')).toBe(30);
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('2h')).toBe(7200);
    expect(durationToSeconds('3d')).toBe(259200);
  });

  it('returns NaN for unsupported duration strings', () => {
    expect(Number.isNaN(durationToSeconds('0m'))).toBe(true);
    expect(Number.isNaN(durationToSeconds('abc'))).toBe(true);
  });

  it('validates CORS origins directly', () => {
    expect(isValidCorsOrigin('https://app.example.com')).toBe(true);
    expect(isValidCorsOrigin('http://localhost:3000')).toBe(true);
    expect(isValidCorsOrigin('ftp://app.example.com')).toBe(false);
    expect(isValidCorsOrigin('https://app.example.com/path')).toBe(false);
    expect(isValidCorsOrigin('https://app.example.com?x=1')).toBe(false);
    expect(isValidCorsOrigin('https://app.example.com#hash')).toBe(false);
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
    expect(parsed.API_PREFIX).toBe('api/v2');
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
    expect(parsed.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
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

  it('rejects non-positive JWT_ACCESS_EXPIRY values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_ACCESS_EXPIRY: '0m',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_ACCESS_EXPIRY: Expected positive duration format like 15m, 7d, 30s, or 2h/,
    );
  });

  it('rejects non-positive JWT_REFRESH_EXPIRY values', () => {
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

  it('rejects JWT_ACCESS_EXPIRY values greater than 24h', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_ACCESS_EXPIRY: '25h',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be less than or equal to 24h/,
    );
  });

  it('does not add cross-expiry errors when access expiry already fails max bound validation', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '25h',
        JWT_REFRESH_EXPIRY: '1h',
      }),
    );

    expect(message).toContain(
      'JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be less than or equal to 24h',
    );
    expect(message).not.toContain(
      'JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY',
    );
  });

  it('does not add cross-expiry errors when refresh expiry already fails max bound validation', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '24h',
        JWT_REFRESH_EXPIRY: '366d',
      }),
    );

    expect(message).toContain(
      'JWT_REFRESH_EXPIRY: JWT_REFRESH_EXPIRY must be less than or equal to 365d',
    );
    expect(message).not.toContain(
      'JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY',
    );
  });

  it('accepts JWT_ACCESS_EXPIRY at the 24h limit', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '24h',
      }),
    );

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('24h');
  });

  it('rejects JWT_REFRESH_EXPIRY values greater than 365d', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_REFRESH_EXPIRY: '366d',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_REFRESH_EXPIRY: JWT_REFRESH_EXPIRY must be less than or equal to 365d/,
    );
  });

  it('accepts JWT_REFRESH_EXPIRY at the 365d limit', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_REFRESH_EXPIRY: '365d',
      }),
    );

    expect(parsed.JWT_REFRESH_EXPIRY).toBe('365d');
  });

  it('rejects JWT_ACCESS_EXPIRY values that are not shorter than JWT_REFRESH_EXPIRY', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_ACCESS_EXPIRY: '24h',
          JWT_REFRESH_EXPIRY: '1h',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY/,
    );
  });

  it('rejects JWT_ACCESS_EXPIRY values equal to JWT_REFRESH_EXPIRY', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_ACCESS_EXPIRY: '1h',
          JWT_REFRESH_EXPIRY: '1h',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY/,
    );
  });

  it('rejects cross-unit durations when access and refresh expiries are equal', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_ACCESS_EXPIRY: '60m',
          JWT_REFRESH_EXPIRY: '1h',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY/,
    );
  });

  it('accepts cross-unit durations when access expiry is shorter', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '59m',
        JWT_REFRESH_EXPIRY: '1h',
      }),
    );

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('59m');
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('1h');
  });

  it('accepts JWT_ACCESS_EXPIRY values that are shorter than JWT_REFRESH_EXPIRY', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '1h',
        JWT_REFRESH_EXPIRY: '2h',
      }),
    );

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('1h');
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('2h');
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
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
      }),
    );

    expect(message).toContain(
      'GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required when NODE_ENV=production',
    );
    expect(message).toContain(
      'GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET is required when NODE_ENV=production',
    );
    expect(message).toContain(
      'GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL is required when NODE_ENV=production',
    );
    expect(message).not.toContain('ML_SERVICE_URL');
  });

  it('reports only missing Google OAuth fields in production when partially configured', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
      }),
    );

    expect(message).toContain(
      'GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL is required when NODE_ENV=production',
    );
    expect(message).not.toContain('ML_SERVICE_URL');
  });

  it('reports missing client id in production when secret and callback are provided', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
      }),
    );

    expect(message).toContain(
      'GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required when NODE_ENV=production',
    );
    expect(message).not.toContain('ML_SERVICE_URL');
  });

  it('accepts NODE_ENV=test with base config', () => {
    const parsed = validateEnv(
      createBaseConfig({
        NODE_ENV: 'test',
      }),
    );

    expect(parsed.NODE_ENV).toBe('test');
  });

  it('rejects partial Google OAuth config in test mode', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'test',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL, GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must be provided with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
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

  it('rejects non-string GOOGLE_CLIENT_ID values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          GOOGLE_CLIENT_ID: 123,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: Invalid input: expected string, received number/,
    );
  });

  it('rejects non-string GOOGLE_CALLBACK_URL values', () => {
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

  it('rejects short GOOGLE_CLIENT_ID values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          GOOGLE_CLIENT_ID: 'short',
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: Too small: expected string to have >=10 characters/,
    );
  });

  it('rejects 9-character GOOGLE_CLIENT_ID values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          GOOGLE_CLIENT_ID: '123456789',
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_ID: Too small: expected string to have >=10 characters/,
    );
  });

  it('accepts 10-character GOOGLE_CLIENT_ID values', () => {
    const parsed = validateEnv(
      createBaseConfig({
        GOOGLE_CLIENT_ID: '1234567890',
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
      }),
    );

    expect(parsed.GOOGLE_CLIENT_ID).toBe('1234567890');
  });

  it('rejects 9-character GOOGLE_CLIENT_SECRET values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: '123456789',
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_SECRET: Too small: expected string to have >=10 characters/,
    );
  });

  it('accepts 10-character GOOGLE_CLIENT_SECRET values', () => {
    const parsed = validateEnv(
      createBaseConfig({
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: '1234567890',
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
      }),
    );

    expect(parsed.GOOGLE_CLIENT_SECRET).toBe('1234567890');
  });

  it('rejects invalid CORS_ORIGINS values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'http//localhost:3000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS entries must be valid HTTP or HTTPS origins \(no path, query, or fragment\)/,
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
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS entries must be valid HTTP or HTTPS origins \(no path, query, or fragment\)/,
    );
  });

  it('rejects CORS_ORIGINS values with path components', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'http://localhost:3000/api',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS entries must be valid HTTP or HTTPS origins \(no path, query, or fragment\)/,
    );
  });

  it('rejects CORS_ORIGINS values with query strings', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'http://localhost:3000?debug=true',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS entries must be valid HTTP or HTTPS origins \(no path, query, or fragment\)/,
    );
  });

  it('rejects CORS_ORIGINS values with hash fragments', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'http://localhost:3000#section',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS entries must be valid HTTP or HTTPS origins \(no path, query, or fragment\)/,
    );
  });

  it('rejects CORS_ORIGINS values with empty segments', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'http://localhost:3000,',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS must not contain empty entries/,
    );
  });

  it('rejects non-string CORS_ORIGINS values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 123,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: Invalid input: expected string, received number/,
    );
  });

  it('normalizes whitespace in CORS_ORIGINS values', () => {
    const parsed = validateEnv(
      createBaseConfig({
        CORS_ORIGINS:
          ' https://app.example.com , http://localhost:3000 , https://admin.example.com ',
      }),
    );

    expect(parsed.CORS_ORIGINS).toEqual([
      'https://app.example.com',
      'http://localhost:3000',
      'https://admin.example.com',
    ]);
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

  it('rejects uppercase-scheme ML_SERVICE_URL values in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
          ML_SERVICE_URL: 'HTTP://ml.internal:5000',
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
