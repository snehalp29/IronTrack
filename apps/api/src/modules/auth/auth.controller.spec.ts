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

  const controller = new AuthController(authServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates register', async () => {
    (authServiceMock.register as jest.Mock).mockResolvedValue({ ok: true });

    await expect(
      controller.register({
        email: 'user@example.com',
        password: '12345678',
        name: 'User',
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('delegates login', async () => {
    (authServiceMock.login as jest.Mock).mockResolvedValue({ ok: true });

    await expect(
      controller.login({ email: 'user@example.com', password: '12345678' }),
    ).resolves.toEqual({ ok: true });
  });

  it('delegates refresh', async () => {
    (authServiceMock.refresh as jest.Mock).mockResolvedValue({ ok: true });

    await expect(
      controller.refresh({ refreshToken: 'refresh-token-value-123' }),
    ).resolves.toEqual({ ok: true });
  });

  it('delegates google auth', async () => {
    (authServiceMock.googleLogin as jest.Mock).mockResolvedValue({ ok: true });

    await expect(
      controller.google({ idToken: 'google-token-value-12345' }),
    ).resolves.toEqual({ ok: true });
  });

  it('delegates logout with refresh token', async () => {
    (authServiceMock.logout as jest.Mock).mockResolvedValue({ success: true });

    await expect(
      controller.logout({ refreshToken: 'refresh-token-123' }),
    ).resolves.toEqual({ success: true });
    expect(authServiceMock.logout).toHaveBeenCalledWith('refresh-token-123');
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
