import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController', () => {
  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    googleLogin: jest.fn(),
    logout: jest.fn(),
  } as unknown as AuthService;
  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      switch (key) {
        case 'API_PREFIX':
          return 'api/v1';
        case 'JWT_REFRESH_EXPIRY':
          return '7d';
        case 'NODE_ENV':
          return 'test';
        default:
          throw new Error(`Unexpected config key ${key}`);
      }
    }),
  } as unknown as ConfigService;

  const controller = new AuthController(authServiceMock, configServiceMock);

  function createResponseMock(): Response {
    return {
      clearCookie: jest.fn(),
      cookie: jest.fn(),
    } as unknown as Response;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates register', async () => {
    const response = createResponseMock();
    (authServiceMock.register as jest.Mock).mockResolvedValue({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    await expect(
      controller.register(
        {
          email: 'user@example.com',
          password: '12345678',
          name: 'User',
        },
        response,
      ),
    ).resolves.toEqual({ accessToken: 'access-token-123' });
    expect(response.cookie).toHaveBeenCalledWith(
      'irontrack_refresh_token',
      'refresh-token-123',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 604800000,
        path: '/api/v1/auth',
        sameSite: 'lax',
        secure: false,
      }),
    );
  });

  it('delegates login', async () => {
    const response = createResponseMock();
    (authServiceMock.login as jest.Mock).mockResolvedValue({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    await expect(
      controller.login(
        { email: 'user@example.com', password: '12345678' },
        response,
      ),
    ).resolves.toEqual({ accessToken: 'access-token-123' });
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('delegates refresh using the request cookie when the body omits the token', async () => {
    const response = createResponseMock();
    (authServiceMock.refresh as jest.Mock).mockResolvedValue({
      accessToken: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
    });

    await expect(
      controller.refresh(
        {},
        {
          cookies: {
            irontrack_refresh_token: 'refresh-token-value-123',
          },
        } as unknown as Request,
        response,
      ),
    ).resolves.toEqual({ accessToken: 'fresh-access-token' });
    expect(authServiceMock.refresh).toHaveBeenCalledWith({
      refreshToken: 'refresh-token-value-123',
    });
    expect(response.cookie).toHaveBeenCalledWith(
      'irontrack_refresh_token',
      'fresh-refresh-token',
      expect.objectContaining({
        path: '/api/v1/auth',
      }),
    );
  });

  it('rejects refresh when only a body refresh token is provided', async () => {
    const response = createResponseMock();

    await expect(
      controller.refresh(
        {
          refreshToken: 'refresh-token-value-123',
        } as never,
        { cookies: {} } as unknown as Request,
        response,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVALID_REFRESH_TOKEN',
      }),
    });
    expect(authServiceMock.refresh).not.toHaveBeenCalled();
  });

  it('delegates google auth', async () => {
    const response = createResponseMock();
    (authServiceMock.googleLogin as jest.Mock).mockResolvedValue({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    await expect(
      controller.google({ idToken: 'google-token-value-12345' }, response),
    ).resolves.toEqual({ accessToken: 'access-token-123' });
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it('delegates logout with the cookie refresh token and clears the cookie', async () => {
    const response = createResponseMock();
    (authServiceMock.logout as jest.Mock).mockResolvedValue({ success: true });

    await expect(
      controller.logout(
        {},
        {
          cookies: {
            irontrack_refresh_token: 'refresh-token-123',
          },
        } as unknown as Request,
        response,
      ),
    ).resolves.toEqual({ success: true });
    expect(authServiceMock.logout).toHaveBeenCalledWith('refresh-token-123');
    expect(response.clearCookie).toHaveBeenCalledWith(
      'irontrack_refresh_token',
      expect.objectContaining({
        path: '/api/v1/auth',
      }),
    );
  });

  it('reuses cached refresh cookie config instead of reading config on every request', async () => {
    const response = createResponseMock();
    (authServiceMock.login as jest.Mock).mockResolvedValue({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    await controller.login(
      { email: 'user@example.com', password: '12345678' },
      response,
    );

    expect(configServiceMock.getOrThrow).not.toHaveBeenCalled();
  });

  it('marks token-based auth endpoints as public', () => {
    const methods = [
      'register',
      'login',
      'refresh',
      'google',
      'logout',
    ] as const;

    for (const method of methods) {
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype[method]),
      ).toBe(true);
    }
  });
});
