import { UnauthorizedException } from '@nestjs/common';

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

  it('rejects tokens with a blank subject before hitting the auth service', async () => {
    const authServiceMock = {
      validateUserFromPayload: jest.fn(),
    };
    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };

    const strategy = new JwtStrategy(
      configServiceMock as never,
      authServiceMock as never,
    );

    await expect(
      strategy.validate({ sub: '   ', email: 'user@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authServiceMock.validateUserFromPayload).not.toHaveBeenCalled();
  });

  it('rejects tokens with a blank email before hitting the auth service', async () => {
    const authServiceMock = {
      validateUserFromPayload: jest.fn(),
    };
    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };

    const strategy = new JwtStrategy(
      configServiceMock as never,
      authServiceMock as never,
    );

    await expect(
      strategy.validate({ sub: 'user-1', email: '   ' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authServiceMock.validateUserFromPayload).not.toHaveBeenCalled();
  });
});
