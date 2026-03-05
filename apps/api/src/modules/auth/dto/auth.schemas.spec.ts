import {
  googleAuthSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './auth.schemas';

describe('auth schemas', () => {
  it('normalizes optional register strings by trimming values', () => {
    expect(
      registerSchema.parse({
        email: 'athlete@example.com',
        password: 'password123',
        name: '  Athlete Name  ',
        timezone: '  America/New_York  ',
      }),
    ).toEqual({
      email: 'athlete@example.com',
      password: 'password123',
      name: 'Athlete Name',
      timezone: 'America/New_York',
    });
  });

  it('treats blank optional register strings as missing', () => {
    expect(
      registerSchema.parse({
        email: 'athlete@example.com',
        password: 'password123',
        name: '   ',
        timezone: '   ',
      }),
    ).toEqual({
      email: 'athlete@example.com',
      password: 'password123',
      name: undefined,
      timezone: undefined,
    });
  });

  it('requires valid login credentials shape', () => {
    expect(
      loginSchema.safeParse({
        email: 'athlete@example.com',
        password: 'password123',
      }).success,
    ).toBe(true);

    expect(
      loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        email: 'athlete@example.com',
        password: 'short',
      }).success,
    ).toBe(false);
  });

  it('requires refresh token minimum length', () => {
    expect(
      refreshSchema.safeParse({
        refreshToken: 'valid-refresh-token-123',
      }).success,
    ).toBe(true);
    expect(
      refreshSchema.safeParse({
        refreshToken: 'short',
      }).success,
    ).toBe(false);
  });

  it('requires google id token minimum length', () => {
    expect(
      googleAuthSchema.safeParse({
        idToken: 'google-id-token-1234567890',
      }).success,
    ).toBe(true);
    expect(
      googleAuthSchema.safeParse({
        idToken: 'too-short',
      }).success,
    ).toBe(false);
  });
});
