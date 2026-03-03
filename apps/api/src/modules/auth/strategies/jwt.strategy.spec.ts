import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('calls auth service validation and returns payload', async () => {
    const authServiceMock = {
      validateUserFromPayload: jest.fn(async () => ({ id: 'user-1' })),
    };
    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };

    const strategy = new JwtStrategy(
      configServiceMock as never,
      authServiceMock as never,
    );

    const payload = { sub: 'user-1', email: 'user@example.com' };

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
    expect(authServiceMock.validateUserFromPayload).toHaveBeenCalledWith(
      payload,
    );
  });
});
