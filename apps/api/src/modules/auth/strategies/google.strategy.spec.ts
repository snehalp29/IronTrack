import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('uses local defaults when Google OAuth config is missing in non-production', () => {
    process.env.NODE_ENV = 'test';

    expect(
      () =>
        new GoogleStrategy({
          get: jest.fn().mockReturnValue(undefined),
        } as never),
    ).not.toThrow();
  });

  it('throws in production when client id/secret are missing', () => {
    process.env.NODE_ENV = 'production';

    expect(
      () =>
        new GoogleStrategy({
          get: jest.fn().mockReturnValue(undefined),
        } as never),
    ).toThrow(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production.',
    );
  });

  it('does not throw in production when client id and secret are configured', () => {
    process.env.NODE_ENV = 'production';

    expect(
      () =>
        new GoogleStrategy({
          get: jest.fn((key: string) => {
            if (key === 'GOOGLE_CLIENT_ID') {
              return 'client-id';
            }
            if (key === 'GOOGLE_CLIENT_SECRET') {
              return 'client-secret';
            }
            if (key === 'GOOGLE_CALLBACK_URL') {
              return 'https://example.com/callback';
            }
            return undefined;
          }),
        } as never),
    ).not.toThrow();
  });

  it('passes tokens and profile to done callback', async () => {
    process.env.NODE_ENV = 'test';

    const strategy = new GoogleStrategy({
      get: jest.fn().mockReturnValue(undefined),
    } as never);

    const done = jest.fn();
    const profile = { id: 'google-profile' };

    await strategy.validate('access', 'refresh', profile as never, done);

    expect(done).toHaveBeenCalledWith(null, {
      accessToken: 'access',
      refreshToken: 'refresh',
      profile,
    });
  });
});
