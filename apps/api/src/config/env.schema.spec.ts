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
});
