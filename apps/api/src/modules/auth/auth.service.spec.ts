import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('AuthService', () => {
  type UserRecord = {
    id: string;
    email: string;
    passwordHash: string;
    authProvider: 'LOCAL' | 'GOOGLE';
    deletedAt?: Date | null;
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
  type UserFindFirstArgs = {
    where: { id?: string; email?: string; deletedAt?: null };
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
    where: {
      tokenHash?: string;
      id?: string;
      revokedAt: null;
      expiresAt?: { gt: Date };
    };
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
      findFirst: jest.fn(
        async ({ where }: UserFindFirstArgs) =>
          users.find((user) => {
            const matchesId = where.id === undefined || user.id === where.id;
            const matchesEmail =
              where.email === undefined || user.email === where.email;
            const userDeletedAt = user.deletedAt ?? null;
            const matchesDeletedAt =
              where.deletedAt === undefined ||
              userDeletedAt === where.deletedAt;
            return matchesId && matchesEmail && matchesDeletedAt;
          }) ?? null,
      ),
      create: jest.fn(async ({ data }: UserCreateArgs) => {
        const user = {
          id: randomUUID(),
          email: data.email,
          passwordHash: data.passwordHash,
          authProvider: 'LOCAL' as const,
          deletedAt: null,
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
          deletedAt: null,
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
            const user = users.find((entry) => entry.id === token.userId);
            return {
              ...token,
              user:
                user === undefined
                  ? null
                  : {
                      ...user,
                      deletedAt: user.deletedAt ?? null,
                    },
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
              (where.tokenHash === undefined ||
                token.tokenHash === where.tokenHash) &&
              (where.id === undefined || token.id === where.id) &&
              token.revokedAt === where.revokedAt &&
              (where.expiresAt === undefined ||
                token.expiresAt > where.expiresAt.gt)
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
    expect(() => parser.parseDurationToMs('invalid')).toThrow(
      'Invalid JWT_REFRESH_EXPIRY value: invalid',
    );
    expect(() => parser.parseDurationToMs('0m')).toThrow(
      'Invalid JWT_REFRESH_EXPIRY value: 0m',
    );
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

  it('applies UTC timezone when creating google-auth users', async () => {
    await authService.googleLogin({
      idToken: 'valid-google-id-token-1234567890',
    });

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          timezone: 'UTC',
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

  it('rejects registration when email is already taken', async () => {
    users.push({
      id: randomUUID(),
      email: 'taken@example.com',
      passwordHash: 'hash',
      authProvider: 'LOCAL',
    });

    await expect(
      authService.register({
        email: 'taken@example.com',
        password: 'Str0ngPassword!',
        name: 'Taken',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps create-time unique constraint races to EMAIL_TAKEN', async () => {
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      }),
    );

    await expect(
      authService.register({
        email: 'race@example.com',
        password: 'Str0ngPassword!',
        name: 'Race',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_TAKEN',
        message: 'Email already in use',
      },
    });
  });

  it('rethrows unexpected registration create errors', async () => {
    const unexpected = new Error('database unavailable');
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(unexpected);

    await expect(
      authService.register({
        email: 'unexpected@example.com',
        password: 'Str0ngPassword!',
        name: 'Unexpected',
      }),
    ).rejects.toBe(unexpected);
  });

  it('rejects login when user is missing', async () => {
    await expect(
      authService.login({
        email: 'missing@example.com',
        password: 'Str0ngPassword!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login when password does not match', async () => {
    users.push({
      id: randomUUID(),
      email: 'john@example.com',
      passwordHash: await hash('different-password', 12),
      authProvider: 'LOCAL',
    });

    await expect(
      authService.login({
        email: 'john@example.com',
        password: 'Str0ngPassword!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for soft-deleted local users', async () => {
    users.push({
      id: randomUUID(),
      email: 'deleted@example.com',
      passwordHash: await hash('Str0ngPassword!', 12),
      authProvider: 'LOCAL',
      deletedAt: new Date('2026-03-05T00:00:00.000Z'),
    });

    await expect(
      authService.login({
        email: 'deleted@example.com',
        password: 'Str0ngPassword!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid refresh token', async () => {
    await expect(
      authService.refresh({
        refreshToken: 'non-existent-refresh-token',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses conditional token revocation when refreshing tokens', async () => {
    const userId = randomUUID();
    users.push({
      id: userId,
      email: 'refresh-guard@example.com',
      passwordHash: 'hash',
      authProvider: 'LOCAL',
    });

    const rawRefreshToken = 'refresh-token-guard-123';
    const storedTokenId = randomUUID();
    refreshTokens.push({
      id: storedTokenId,
      userId,
      tokenHash: createHash('sha256').update(rawRefreshToken).digest('hex'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await authService.refresh({
      refreshToken: rawRefreshToken,
    });

    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: storedTokenId,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('rejects refresh when token was concurrently consumed', async () => {
    const userId = randomUUID();
    users.push({
      id: userId,
      email: 'race@example.com',
      passwordHash: 'hash',
      authProvider: 'LOCAL',
    });

    const rawRefreshToken = 'refresh-token-race-123';
    refreshTokens.push({
      id: randomUUID(),
      userId,
      tokenHash: createHash('sha256').update(rawRefreshToken).digest('hex'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    (prismaMock.refreshToken.updateMany as jest.Mock).mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      authService.refresh({
        refreshToken: rawRefreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects refresh token when expiresAt is exactly now', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-03T00:00:00.000Z'));

    try {
      const userId = randomUUID();
      users.push({
        id: userId,
        email: 'expires-now@example.com',
        passwordHash: 'hash',
        authProvider: 'LOCAL',
      });

      const rawRefreshToken = 'refresh-token-expires-now-123';
      refreshTokens.push({
        id: randomUUID(),
        userId,
        tokenHash: createHash('sha256').update(rawRefreshToken).digest('hex'),
        revokedAt: null,
        expiresAt: new Date('2026-03-03T00:00:00.000Z'),
      });

      await expect(
        authService.refresh({
          refreshToken: rawRefreshToken,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      jest.useRealTimers();
    }
  });

  it('accepts refresh token when expiresAt is in the future by one millisecond', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-03T00:00:00.000Z'));

    try {
      const signSpy = jest
        .spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      const userId = randomUUID();
      users.push({
        id: userId,
        email: 'expires-future@example.com',
        passwordHash: 'hash',
        authProvider: 'LOCAL',
      });

      const rawRefreshToken = 'refresh-token-future-123';
      refreshTokens.push({
        id: randomUUID(),
        userId,
        tokenHash: createHash('sha256').update(rawRefreshToken).digest('hex'),
        revokedAt: null,
        expiresAt: new Date('2026-03-03T00:00:00.001Z'),
      });

      await expect(
        authService.refresh({
          refreshToken: rawRefreshToken,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        }),
      );
      signSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('issues a distinct refresh token on rotation even within the same second', async () => {
    const registered = await authService.register({
      email: 'rotation@example.com',
      password: 'Str0ngPassword!',
      name: 'Rotation',
    });
    const refreshPayload = jwtService.verify<{ iat: number }>(
      registered.refreshToken,
      {
        secret: 'refresh-secret-1234567890',
      },
    );
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(refreshPayload.iat * 1000);

    try {
      const rotated = await authService.refresh({
        refreshToken: registered.refreshToken,
      });

      expect(rotated.refreshToken).not.toBe(registered.refreshToken);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('rejects refresh token for soft-deleted users', async () => {
    const userId = randomUUID();
    users.push({
      id: userId,
      email: 'deleted-refresh@example.com',
      passwordHash: 'hash',
      authProvider: 'LOCAL',
      deletedAt: new Date('2026-03-05T00:00:00.000Z'),
    });

    const rawRefreshToken = 'refresh-token-deleted-user-123';
    refreshTokens.push({
      id: randomUUID(),
      userId,
      tokenHash: createHash('sha256').update(rawRefreshToken).digest('hex'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      authService.refresh({
        refreshToken: rawRefreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects google login for soft-deleted accounts', async () => {
    users.push({
      id: randomUUID(),
      email: 'verified@irontrack.local',
      passwordHash: 'hash',
      authProvider: 'LOCAL',
      deletedAt: new Date('2026-03-05T00:00:00.000Z'),
    });

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
  });

  it('validates and returns user from JWT payload', async () => {
    const user = {
      id: randomUUID(),
      email: 'payload@example.com',
      passwordHash: 'hash',
      authProvider: 'LOCAL' as const,
    };
    users.push(user);

    await expect(
      authService.validateUserFromPayload({
        sub: user.id,
        email: user.email,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ id: user.id, email: user.email }),
    );
  });

  it('rejects JWT payload when user no longer exists', async () => {
    await expect(
      authService.validateUserFromPayload({
        sub: randomUUID(),
        email: 'missing@example.com',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects JWT payload when user is soft-deleted', async () => {
    const user = {
      id: randomUUID(),
      email: 'deleted-payload@example.com',
      passwordHash: 'hash',
      authProvider: 'LOCAL' as const,
      deletedAt: new Date('2026-03-05T00:00:00.000Z'),
    };
    users.push(user);

    await expect(
      authService.validateUserFromPayload({
        sub: user.id,
        email: user.email,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
