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
  'https://auth.example.com/oauth/google/callback';
const VALID_PRODUCTION_CORS_ORIGIN = 'https://app.example.com';

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

function parseWithWhitespacedNormalizedFields() {
  return validateEnv(
    createBaseConfig({
      DATABASE_URL: '  postgresql://user:password@db.example.com:5432/mydb  ',
      API_PREFIX: '  /api/v2/  ',
      JWT_ACCESS_SECRET: '  access-secret-for-testing-only  ',
      JWT_REFRESH_SECRET: '  refresh-secret-for-testing-only  ',
    }),
  );
}

function parseWithWhitespacedJwtExpiries() {
  return validateEnv(
    createBaseConfig({
      JWT_ACCESS_EXPIRY: ' 15m ',
      JWT_REFRESH_EXPIRY: '\t7d\n',
    }),
  );
}

function parseWithBlankGoogleOAuthFields() {
  return validateEnv(
    createBaseConfig({
      NODE_ENV: 'development',
      GOOGLE_CLIENT_ID: '   ',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_CALLBACK_URL: '\n\t',
    }),
  );
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

describe('getValidationErrorMessageFrom', () => {
  it('formats non-Error throws in the helper', () => {
    const message = getValidationErrorMessageFrom({}, () => {
      throw 'boom';
    });

    expect(message).toBe('validateEnv threw a non-Error: boom');
  });
});

describe('validateEnv', () => {
  it('defaults NODE_ENV to development', () => {
    const parsed = validateEnv(createBaseConfig());
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('defaults API_PORT to 3000', () => {
    const parsed = validateEnv(createBaseConfig());
    expect(parsed.API_PORT).toBe(3000);
  });

  it('defaults API_PREFIX to api/v1', () => {
    const parsed = validateEnv(createBaseConfig());
    expect(parsed.API_PREFIX).toBe('api/v1');
  });

  it('defaults JWT_ACCESS_EXPIRY to 15m', () => {
    const parsed = validateEnv(createBaseConfig());
    expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
  });

  it('defaults JWT_REFRESH_EXPIRY to 7d', () => {
    const parsed = validateEnv(createBaseConfig());
    expect(parsed.JWT_REFRESH_EXPIRY).toBe('7d');
  });

  it('defaults ML_SERVICE_URL to localhost http endpoint', () => {
    const parsed = validateEnv(createBaseConfig());
    expect(parsed.ML_SERVICE_URL).toBe('http://localhost:5000');
  });

  it('defaults CORS_ORIGINS to local dev origins', () => {
    const parsed = validateEnv(createBaseConfig());
    expect(parsed.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
  });

  it('converts second-based duration strings to seconds', () => {
    expect(durationToSeconds('30s')).toBe(30);
  });

  it('converts minimum valid duration strings to seconds', () => {
    expect(durationToSeconds('1s')).toBe(1);
  });

  it('converts minute-based duration strings to seconds', () => {
    expect(durationToSeconds('15m')).toBe(900);
  });

  it('converts hour-based duration strings to seconds', () => {
    expect(durationToSeconds('2h')).toBe(7200);
  });

  it('converts day-based duration strings to seconds', () => {
    expect(durationToSeconds('3d')).toBe(259200);
  });

  it('converts multi-digit duration strings to seconds', () => {
    expect(durationToSeconds('120m')).toBe(7200);
  });

  it('converts refresh expiry boundary duration strings to seconds', () => {
    expect(durationToSeconds('365d')).toBe(31536000);
  });

  it('returns NaN for zero-value duration strings', () => {
    expect(durationToSeconds('0m')).toBeNaN();
  });

  it('returns NaN for malformed duration strings', () => {
    expect(durationToSeconds('abc')).toBeNaN();
  });

  it('accepts https CORS origins', () => {
    expect(isValidCorsOrigin('https://app.example.com')).toBe(true);
  });

  it('accepts localhost CORS origins with explicit ports', () => {
    expect(isValidCorsOrigin('http://localhost:3000')).toBe(true);
  });

  it('accepts non-standard https CORS origin ports', () => {
    expect(isValidCorsOrigin('https://app.example.com:8443')).toBe(true);
  });

  it('accepts non-standard http localhost CORS origin ports', () => {
    expect(isValidCorsOrigin('http://localhost:8080')).toBe(true);
  });

  it('rejects CORS origins with unsupported protocols', () => {
    expect(isValidCorsOrigin('ftp://app.example.com')).toBe(false);
  });

  it('rejects CORS origins with path components', () => {
    expect(isValidCorsOrigin('https://app.example.com/path')).toBe(false);
  });

  it('rejects CORS origins with query strings', () => {
    expect(isValidCorsOrigin('https://app.example.com?x=1')).toBe(false);
  });

  it('rejects CORS origins with hash fragments', () => {
    expect(isValidCorsOrigin('https://app.example.com#hash')).toBe(false);
  });

  it('rejects empty CORS origins', () => {
    expect(isValidCorsOrigin('')).toBe(false);
  });

  it('normalizes whitespace around DATABASE_URL', () => {
    const parsed = parseWithWhitespacedNormalizedFields();

    expect(parsed.DATABASE_URL).toBe(VALID_DATABASE_URL);
  });

  it('normalizes API_PREFIX by trimming whitespace and slashes', () => {
    const parsed = parseWithWhitespacedNormalizedFields();

    expect(parsed.API_PREFIX).toBe('api/v2');
  });

  it('normalizes whitespace around JWT_ACCESS_SECRET', () => {
    const parsed = parseWithWhitespacedNormalizedFields();

    expect(parsed.JWT_ACCESS_SECRET).toBe(VALID_ACCESS_SECRET);
  });

  it('normalizes whitespace around JWT_REFRESH_SECRET', () => {
    const parsed = parseWithWhitespacedNormalizedFields();

    expect(parsed.JWT_REFRESH_SECRET).toBe(VALID_REFRESH_SECRET);
  });

  it('falls back to default API_PREFIX when blank string is provided', () => {
    const parsed = validateEnv(
      createBaseConfig({
        API_PREFIX: '   ',
      }),
    );

    expect(parsed.API_PREFIX).toBe('api/v1');
  });

  it('falls back to default CORS_ORIGINS when blank string is provided', () => {
    const parsed = validateEnv(
      createBaseConfig({
        CORS_ORIGINS: '\n\t',
      }),
    );

    expect(parsed.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
  });

  it('rejects missing CORS_ORIGINS in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
          ML_SERVICE_URL: 'https://ml.example.com',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS is required when NODE_ENV=production/,
    );
  });

  it('rejects blank CORS_ORIGINS in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
          ML_SERVICE_URL: 'https://ml.example.com',
          CORS_ORIGINS: '   ',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: CORS_ORIGINS is required when NODE_ENV=production/,
    );
  });

  it('falls back to default API_PREFIX when only slashes are provided', () => {
    const parsed = validateEnv(
      createBaseConfig({
        API_PREFIX: '///',
      }),
    );

    expect(parsed.API_PREFIX).toBe('api/v1');
  });

  it('reports DATABASE_URL issue details for invalid values', () => {
    const message = getValidationErrorMessage({
      DATABASE_URL: 'not-a-url',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
    });

    expect(message).toContain('DATABASE_URL: Invalid URL');
  });

  it('reports JWT_ACCESS_SECRET issue details for invalid values', () => {
    const message = getValidationErrorMessage({
      DATABASE_URL: 'not-a-url',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
    });

    expect(message).toContain(
      'JWT_ACCESS_SECRET: Too small: expected string to have >=16 characters',
    );
  });

  it('reports JWT_REFRESH_SECRET issue details for invalid values', () => {
    const message = getValidationErrorMessage({
      DATABASE_URL: 'not-a-url',
      JWT_ACCESS_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
    });

    expect(message).toContain(
      'JWT_REFRESH_SECRET: Too small: expected string to have >=16 characters',
    );
  });

  it('reports missing JWT_ACCESS_SECRET details when required secret is absent', () => {
    const message = getValidationErrorMessage({
      DATABASE_URL: VALID_DATABASE_URL,
    });

    expect(message).toContain(
      'JWT_ACCESS_SECRET: Invalid input: expected string, received undefined',
    );
  });

  it('reports missing JWT_REFRESH_SECRET details when required secret is absent', () => {
    const message = getValidationErrorMessage({
      DATABASE_URL: VALID_DATABASE_URL,
    });

    expect(message).toContain(
      'JWT_REFRESH_SECRET: Invalid input: expected string, received undefined',
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

  it('accepts postgres:// short scheme in DATABASE_URL', () => {
    const parsed = validateEnv(
      createBaseConfig({
        DATABASE_URL: 'postgres://user:pass@db.example.com:5432/mydb',
      }),
    );

    expect(parsed.DATABASE_URL).toBe(
      'postgres://user:pass@db.example.com:5432/mydb',
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

  it('rejects non-string API_PREFIX values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          API_PREFIX: 123,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: API_PREFIX: Invalid input: expected string, received number/,
    );
  });

  it('rejects identical JWT access and refresh secrets', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          JWT_ACCESS_SECRET: 'shared-secret-123456',
          JWT_REFRESH_SECRET: 'shared-secret-123456',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: JWT_REFRESH_SECRET: JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET/,
    );
  });

  it('accepts JWT_ACCESS_EXPIRY values with surrounding whitespace and normalizes them', () => {
    const parsed = parseWithWhitespacedJwtExpiries();

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('15m');
  });

  it('accepts JWT_REFRESH_EXPIRY values with surrounding whitespace and normalizes them', () => {
    const parsed = parseWithWhitespacedJwtExpiries();

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

  it('keeps access-expiry max-bound error when access expiry already fails max bound validation', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '25h',
        JWT_REFRESH_EXPIRY: '1h',
      }),
    );

    expect(message).toContain(
      'JWT_ACCESS_EXPIRY: JWT_ACCESS_EXPIRY must be less than or equal to 24h',
    );
  });

  it('omits cross-expiry errors when access expiry already fails max bound validation', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '25h',
        JWT_REFRESH_EXPIRY: '1h',
      }),
    );

    expect(message).not.toContain(
      'JWT_ACCESS_EXPIRY must be shorter than JWT_REFRESH_EXPIRY',
    );
  });

  it('keeps refresh-expiry max-bound error when refresh expiry already fails max bound validation', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '24h',
        JWT_REFRESH_EXPIRY: '366d',
      }),
    );

    expect(message).toContain(
      'JWT_REFRESH_EXPIRY: JWT_REFRESH_EXPIRY must be less than or equal to 365d',
    );
  });

  it('omits cross-expiry errors when refresh expiry already fails max bound validation', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '24h',
        JWT_REFRESH_EXPIRY: '366d',
      }),
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

  it('accepts cross-unit JWT_ACCESS_EXPIRY values when access expiry is shorter', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '59m',
        JWT_REFRESH_EXPIRY: '1h',
      }),
    );

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('59m');
  });

  it('accepts cross-unit JWT_REFRESH_EXPIRY values when access expiry is shorter', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '59m',
        JWT_REFRESH_EXPIRY: '1h',
      }),
    );

    expect(parsed.JWT_REFRESH_EXPIRY).toBe('1h');
  });

  it('accepts JWT_ACCESS_EXPIRY values that are shorter than JWT_REFRESH_EXPIRY (access field)', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '1h',
        JWT_REFRESH_EXPIRY: '2h',
      }),
    );

    expect(parsed.JWT_ACCESS_EXPIRY).toBe('1h');
  });

  it('accepts JWT_ACCESS_EXPIRY values that are shorter than JWT_REFRESH_EXPIRY (refresh field)', () => {
    const parsed = validateEnv(
      createBaseConfig({
        JWT_ACCESS_EXPIRY: '1h',
        JWT_REFRESH_EXPIRY: '2h',
      }),
    );

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

  it('accepts API_PORT at the minimum valid port', () => {
    const parsed = validateEnv(
      createBaseConfig({
        API_PORT: 1,
      }),
    );

    expect(parsed.API_PORT).toBe(1);
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

  it('rejects API_PORT values greater than 65535', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          API_PORT: 65536,
        }),
      ),
    ).toThrow(/Invalid environment configuration: API_PORT:/);
  });

  it('accepts API_PORT at the 65535 boundary', () => {
    const parsed = validateEnv(
      createBaseConfig({
        API_PORT: 65535,
      }),
    );

    expect(parsed.API_PORT).toBe(65535);
  });

  it('reports missing GOOGLE_CLIENT_ID when Google OAuth config is absent in production', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
      }),
    );

    expect(message).toContain(
      'GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID is required when NODE_ENV=production',
    );
  });

  it('reports missing GOOGLE_CLIENT_SECRET when Google OAuth config is absent in production', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
      }),
    );

    expect(message).toContain(
      'GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET is required when NODE_ENV=production',
    );
  });

  it('reports missing GOOGLE_CALLBACK_URL when Google OAuth config is absent in production', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
      }),
    );

    expect(message).toContain(
      'GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL is required when NODE_ENV=production',
    );
  });

  it('does not report ML_SERVICE_URL errors when only Google OAuth config is missing in production', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
      }),
    );

    expect(message).not.toContain('ML_SERVICE_URL');
  });

  it('reports missing GOOGLE_CALLBACK_URL when production Google OAuth config is partially configured', () => {
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
  });

  it('does not report ML_SERVICE_URL errors when production Google OAuth config is partially configured', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
      }),
    );

    expect(message).not.toContain('ML_SERVICE_URL');
  });

  it('reports missing GOOGLE_CLIENT_ID when production secret and callback are provided', () => {
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
  });

  it('does not report ML_SERVICE_URL errors when production secret and callback are provided', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'production',
        ML_SERVICE_URL: 'https://ml.example.com',
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
      }),
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

  it('rejects unknown NODE_ENV values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'staging',
        }),
      ),
    ).toThrow(/Invalid environment configuration: NODE_ENV:/);
  });

  it('reports missing GOOGLE_CLIENT_SECRET for partial Google OAuth config in test mode', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'test',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
      }),
    );

    expect(message).toContain(
      'GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL',
    );
  });

  it('reports missing GOOGLE_CALLBACK_URL for partial Google OAuth config in test mode', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'test',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
      }),
    );

    expect(message).toContain(
      'GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must be provided with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
    );
  });

  it('reports missing GOOGLE_CLIENT_SECRET for partial Google OAuth config outside production', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'development',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
      }),
    );

    expect(message).toContain(
      'GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL',
    );
  });

  it('reports missing GOOGLE_CALLBACK_URL for partial Google OAuth config outside production', () => {
    const message = getValidationErrorMessage(
      createBaseConfig({
        NODE_ENV: 'development',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
      }),
    );

    expect(message).toContain(
      'GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must be provided with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
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

  it('rejects non-production Google OAuth config when client secret is missing and callback is present', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'development',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET must be provided with GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL/,
    );
  });

  it('rejects non-production Google OAuth config when callback is missing and client secret is present', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'development',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must be provided with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
    );
  });

  it('accepts GOOGLE_CLIENT_ID in complete Google OAuth config for production', () => {
    const parsed = validateEnv(
      createBaseConfig({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        ML_SERVICE_URL: 'https://ml.example.com',
        CORS_ORIGINS: VALID_PRODUCTION_CORS_ORIGIN,
      }),
    );

    expect(parsed.GOOGLE_CLIENT_ID).toBe(VALID_GOOGLE_CLIENT_ID);
  });

  it('accepts GOOGLE_CLIENT_SECRET in complete Google OAuth config for production', () => {
    const parsed = validateEnv(
      createBaseConfig({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        ML_SERVICE_URL: 'https://ml.example.com',
        CORS_ORIGINS: VALID_PRODUCTION_CORS_ORIGIN,
      }),
    );

    expect(parsed.GOOGLE_CLIENT_SECRET).toBe(VALID_GOOGLE_CLIENT_SECRET);
  });

  it('accepts GOOGLE_CALLBACK_URL in complete Google OAuth config for production', () => {
    const parsed = validateEnv(
      createBaseConfig({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
        ML_SERVICE_URL: 'https://ml.example.com',
        CORS_ORIGINS: VALID_PRODUCTION_CORS_ORIGIN,
      }),
    );

    expect(parsed.GOOGLE_CALLBACK_URL).toBe(VALID_GOOGLE_CALLBACK_URL);
  });

  it('treats blank GOOGLE_CLIENT_ID values as missing', () => {
    const parsed = parseWithBlankGoogleOAuthFields();

    expect(parsed.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('treats blank GOOGLE_CLIENT_SECRET values as missing', () => {
    const parsed = parseWithBlankGoogleOAuthFields();

    expect(parsed.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });

  it('treats blank GOOGLE_CALLBACK_URL values as missing', () => {
    const parsed = parseWithBlankGoogleOAuthFields();

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

  it('accepts CORS_ORIGINS with a single valid entry', () => {
    const parsed = validateEnv(
      createBaseConfig({
        CORS_ORIGINS: 'https://app.example.com',
      }),
    );

    expect(parsed.CORS_ORIGINS).toEqual(['https://app.example.com']);
  });

  it('rejects CORS_ORIGINS when a non-first entry is invalid', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: 'https://app.example.com,ftp://bad.example.com',
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

  it('rejects array CORS_ORIGINS values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: [],
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: Invalid input: expected string, received array/,
    );
  });

  it('rejects null CORS_ORIGINS values', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          CORS_ORIGINS: null,
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: CORS_ORIGINS: Invalid input: expected string, received null/,
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

  it('accepts explicit http ML_SERVICE_URL values outside production', () => {
    const parsed = validateEnv(
      createBaseConfig({
        ML_SERVICE_URL: 'http://ml.internal:5000',
      }),
    );

    expect(parsed.ML_SERVICE_URL).toBe('http://ml.internal:5000');
  });

  it('accepts http GOOGLE_CALLBACK_URL values outside production', () => {
    const parsed = validateEnv(
      createBaseConfig({
        GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
      }),
    );

    expect(parsed.GOOGLE_CALLBACK_URL).toBe(
      'http://localhost:3000/auth/google/callback',
    );
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

  it('rejects non-http non-https ML_SERVICE_URL values in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
          ML_SERVICE_URL: 'ftp://ml.internal:5000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: ML_SERVICE_URL: ML_SERVICE_URL must use https when NODE_ENV=production/,
    );
  });

  it('returns a validation error when ML_SERVICE_URL is malformed in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: VALID_GOOGLE_CALLBACK_URL,
          ML_SERVICE_URL: 'not-a-url',
        }),
      ),
    ).toThrow(/Invalid environment configuration: ML_SERVICE_URL: Invalid URL/);
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

  it('rejects non-https GOOGLE_CALLBACK_URL values in production when explicitly set', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: 'http://api.example.com/auth/google/callback',
          ML_SERVICE_URL: 'https://ml.internal:5000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must use https when NODE_ENV=production/,
    );
  });

  it('rejects uppercase-scheme GOOGLE_CALLBACK_URL values in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: 'HTTP://api.example.com/auth/google/callback',
          ML_SERVICE_URL: 'https://ml.internal:5000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must use https when NODE_ENV=production/,
    );
  });

  it('rejects non-http non-https GOOGLE_CALLBACK_URL values in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: 'ftp://api.example.com/auth/google/callback',
          ML_SERVICE_URL: 'https://ml.internal:5000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: GOOGLE_CALLBACK_URL must use https when NODE_ENV=production/,
    );
  });

  it('returns a validation error when GOOGLE_CALLBACK_URL is malformed in production', () => {
    expect(() =>
      validateEnv(
        createBaseConfig({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: VALID_GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: VALID_GOOGLE_CLIENT_SECRET,
          GOOGLE_CALLBACK_URL: 'not-a-url',
          ML_SERVICE_URL: 'https://ml.internal:5000',
        }),
      ),
    ).toThrow(
      /Invalid environment configuration: GOOGLE_CALLBACK_URL: Invalid URL/,
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
