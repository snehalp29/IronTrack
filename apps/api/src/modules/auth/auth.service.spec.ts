import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('AuthService', () => {
  type UserRecord = {
    id: string;
    email: string;
    passwordHash: string;
    authProvider: 'LOCAL' | 'GOOGLE';
    timezone?: string;
    unitPreference?: 'METRIC' | 'IMPERIAL';
    googleId?: string;
    name?: string;
    avatarUrl?: string;
  };
  type RefreshTokenRecord = {
    id: string;
    userId: string;
    tokenHash: string;
    revokedAt: Date | null;
    expiresAt: Date;
  };
  type UserFindUniqueArgs = {
    where: { id?: string; email?: string };
  };
  type UserCreateArgs = {
    data: {
      email: string;
      passwordHash: string;
      authProvider?: 'LOCAL' | 'GOOGLE';
      timezone?: string;
      unitPreference?: 'METRIC' | 'IMPERIAL';
      name?: string;
      avatarUrl?: string;
      googleId?: string;
    };
  };
  type UserUpsertArgs = {
    where: { email: string };
    update: Partial<UserRecord>;
    create: UserCreateArgs['data'];
  };
  type RefreshTokenCreateArgs = {
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    };
  };
  type RefreshTokenFindFirstArgs = {
    where: {
      tokenHash: string;
      revokedAt: null;
      expiresAt: { gt: Date };
    };
    include?: { user?: boolean };
  };
  type RefreshTokenUpdateArgs = {
    where: { id: string };
    data: { revokedAt: Date };
  };
  type RefreshTokenUpdateManyArgs = {
    where: { tokenHash: string; revokedAt: null };
    data: { revokedAt: Date };
  };

  const refreshTokens: RefreshTokenRecord[] = [];
  const users: UserRecord[] = [];
  const googleTokenVerifierMock = {
    verifyIdToken: jest.fn<
      Promise<{
        email: string;
        googleId: string;
        name?: string;
        avatarUrl?: string;
      }>,
      [string]
    >(),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(
        async ({ where }: UserFindUniqueArgs) =>
          users.find((user) =>
            where.id ? user.id === where.id : user.email === where.email,
          ) ?? null,
      ),
      create: jest.fn(async ({ data }: UserCreateArgs) => {
        const user = {
          id: randomUUID(),
          email: data.email,
          passwordHash: data.passwordHash,
          authProvider: 'LOCAL' as const,
          timezone: data.timezone,
          unitPreference: data.unitPreference,
          name: data.name,
          avatarUrl: data.avatarUrl,
        };
        users.push(user);
        return user;
      }),
      upsert: jest.fn(async ({ where, update, create }: UserUpsertArgs) => {
        const existing = users.find((user) => user.email === where.email);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const user = {
          id: randomUUID(),
          email: create.email,
          passwordHash: create.passwordHash,
          authProvider: 'GOOGLE' as const,
          timezone: create.timezone,
          unitPreference: create.unitPreference,
          name: create.name,
          avatarUrl: create.avatarUrl,
          googleId: create.googleId,
        };
        users.push(user);
        return user;
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: RefreshTokenCreateArgs) => {
        refreshTokens.push({
          id: randomUUID(),
          userId: data.userId,
          tokenHash: data.tokenHash,
          revokedAt: null,
          expiresAt: data.expiresAt,
        });
        return data;
      }),
      findFirst: jest.fn(
        async ({ where, include }: RefreshTokenFindFirstArgs) => {
          const token = refreshTokens.find(
            (item) =>
              item.tokenHash === where.tokenHash &&
              item.revokedAt === where.revokedAt &&
              item.expiresAt > where.expiresAt.gt,
          );
          if (!token) {
            return null;
          }
          if (include?.user) {
            return {
              ...token,
              user: users.find((user) => user.id === token.userId),
            };
          }
          return token;
        },
      ),
      update: jest.fn(async ({ where, data }: RefreshTokenUpdateArgs) => {
        const token = refreshTokens.find((item) => item.id === where.id);
        if (!token) {
          return undefined;
        }
        token.revokedAt = data.revokedAt;
        return token;
      }),
      updateMany: jest.fn(
        async ({ where, data }: RefreshTokenUpdateManyArgs) => {
          let count = 0;
          for (const token of refreshTokens) {
            if (
              token.tokenHash === where.tokenHash &&
              token.revokedAt === where.revokedAt
            ) {
              token.revokedAt = data.revokedAt;
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
  };

  let authService: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    users.length = 0;
    refreshTokens.length = 0;
    googleTokenVerifierMock.verifyIdToken.mockReset();
    googleTokenVerifierMock.verifyIdToken.mockResolvedValue({
      email: 'verified@irontrack.local',
      googleId: 'google-user-id-123',
      name: 'Verified User',
      avatarUrl: 'https://example.com/avatar.png',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'access-secret-1234567890',
          signOptions: {
            expiresIn: 15 * 60,
          },
        }),
      ],
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              switch (key) {
                case 'JWT_ACCESS_SECRET':
                  return 'access-secret-1234567890';
                case 'JWT_REFRESH_SECRET':
                  return 'refresh-secret-1234567890';
                case 'JWT_ACCESS_EXPIRY':
                  return '15m';
                case 'JWT_REFRESH_EXPIRY':
                  return '7d';
                default:
                  throw new Error(`Unknown key ${key}`);
              }
            },
          },
        },
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: GoogleTokenVerifierService,
          useValue: googleTokenVerifierMock,
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  it('register/login/refresh/logout flow', async () => {
    const registered = await authService.register({
      email: 'john@example.com',
      password: 'Str0ngPassword!',
      name: 'John',
    });

    expect(registered.accessToken).toBeTruthy();
    expect(registered.refreshToken).toBeTruthy();

    const user = users[0];
    user.passwordHash = await hash('Str0ngPassword!', 12);

    const loggedIn = await authService.login({
      email: 'john@example.com',
      password: 'Str0ngPassword!',
    });

    expect(loggedIn.accessToken).toBeTruthy();

    const refreshed = await authService.refresh({
      refreshToken: loggedIn.refreshToken,
    });
    expect(refreshed.accessToken).toBeTruthy();

    const logoutResult = await authService.logout(refreshed.refreshToken);
    expect(logoutResult.success).toBe(true);
  });

  it('parses configured JWT duration strings', () => {
    const parser = authService as unknown as {
      parseDurationToMs: (value: string) => number;
    };

    expect(parser.parseDurationToMs('15m')).toBe(15 * 60_000);
    expect(parser.parseDurationToMs('7d')).toBe(7 * 86_400_000);
    expect(parser.parseDurationToMs('invalid')).toBe(7 * 86_400_000);
  });

  it('uses jwt module defaults for access tokens and explicit options for refresh tokens', async () => {
    const signSpy = jest.spyOn(jwtService, 'signAsync');

    await authService.register({
      email: 'defaults@example.com',
      password: 'Str0ngPassword!',
      name: 'Defaults',
    });

    expect(signSpy).toHaveBeenCalledTimes(2);

    const [accessPayload, accessOptions] = signSpy.mock.calls[0];
    expect(accessPayload).toEqual(
      expect.objectContaining({
        sub: expect.any(String),
        email: 'defaults@example.com',
      }),
    );
    expect(accessOptions).toBeUndefined();

    const [refreshPayload, refreshOptions] = signSpy.mock.calls[1];
    expect(refreshPayload).toEqual(
      expect.objectContaining({
        sub: expect.any(String),
        email: 'defaults@example.com',
      }),
    );
    expect(refreshOptions).toEqual({
      secret: 'refresh-secret-1234567890',
      expiresIn: 7 * 24 * 60 * 60,
    });
  });

  it('google login uses verified token identity', async () => {
    const tokens = await authService.googleLogin({
      idToken: 'valid-google-id-token-1234567890',
    });

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(googleTokenVerifierMock.verifyIdToken).toHaveBeenCalledWith(
      'valid-google-id-token-1234567890',
    );
    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'verified@irontrack.local' },
        update: expect.objectContaining({
          googleId: 'google-user-id-123',
          authProvider: 'GOOGLE',
        }),
      }),
    );
  });

  it('google login requires idToken', async () => {
    await expect(authService.googleLogin({} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(googleTokenVerifierMock.verifyIdToken).not.toHaveBeenCalled();
  });

  it('google login rejects unverified tokens', async () => {
    googleTokenVerifierMock.verifyIdToken.mockRejectedValueOnce(
      new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google token is invalid',
      }),
    );

    await expect(
      authService.googleLogin({
        idToken: 'invalid-google-id-token-1234567890',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
  });
});
