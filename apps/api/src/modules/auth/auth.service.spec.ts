import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcryptjs from 'bcryptjs';
import { hash } from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

jest.mock('bcryptjs', () => {
  const actual = jest.requireActual<typeof import('bcryptjs')>('bcryptjs');
  return {
    ...actual,
    compare: jest.fn(actual.compare),
    hash: jest.fn(actual.hash),
  };
});

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
  type UserUpdateArgs = {
    where: { id: string };
    data: Partial<UserRecord>;
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
          authProvider: (data.authProvider ?? 'LOCAL') as 'LOCAL' | 'GOOGLE',
          deletedAt: null,
          timezone: data.timezone,
          unitPreference: data.unitPreference,
          name: data.name,
          avatarUrl: data.avatarUrl,
          googleId: data.googleId,
        };
        users.push(user);
        return user;
      }),
      update: jest.fn(async ({ where, data }: UserUpdateArgs) => {
        const existing = users.find((user) => user.id === where.id);
        if (!existing) {
          throw new Error('User not found');
        }
        Object.assign(existing, data);
        return existing;
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
    if (jest.isMockFunction(bcryptjs.compare)) {
      (bcryptjs.compare as unknown as jest.Mock).mockClear();
    }
    if (jest.isMockFunction(bcryptjs.hash)) {
      (bcryptjs.hash as unknown as jest.Mock).mockClear();
    }
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

  it('parses refresh duration once per token issuance', async () => {
    const parserSpy = jest.spyOn(
      authService as unknown as {
        parseDurationToMs: (value: string) => number;
      },
      'parseDurationToMs',
    );

    await authService.register({
      email: 'parse-once@example.com',
      password: 'Str0ngPassword!',
      name: 'Parse Once',
    });

    expect(parserSpy).toHaveBeenCalledTimes(1);
    parserSpy.mockRestore();
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
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'verified@irontrack.local',
          googleId: 'google-user-id-123',
          authProvider: 'GOOGLE',
          timezone: 'UTC',
        }),
      }),
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('normalizes verified google email before matching existing accounts', async () => {
    users.push({
      id: randomUUID(),
      email: 'verified@irontrack.local',
      passwordHash: await hash('Str0ngPassword!', 12),
      authProvider: 'LOCAL',
      deletedAt: null,
    });
    googleTokenVerifierMock.verifyIdToken.mockResolvedValueOnce({
      email: 'Verified@IronTrack.Local',
      googleId: 'google-user-id-123',
      name: 'Verified User',
      avatarUrl: 'https://example.com/avatar.png',
    });

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_REGISTERED_WITH_PASSWORD',
      },
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects google login for accounts registered with password auth', async () => {
    users.push({
      id: randomUUID(),
      email: 'verified@irontrack.local',
      passwordHash: await hash('Str0ngPassword!', 12),
      authProvider: 'LOCAL',
      deletedAt: null,
    });

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_REGISTERED_WITH_PASSWORD',
      },
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects google login when create races with concurrent LOCAL account creation', async () => {
    (prismaMock.user.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: randomUUID(),
        email: 'verified@irontrack.local',
        passwordHash: 'hash',
        authProvider: 'LOCAL',
        deletedAt: null,
      });
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_REGISTERED_WITH_PASSWORD',
      },
    });
  });

  it('rejects google login when updated account no longer has GOOGLE provider', async () => {
    const googleUserId = randomUUID();
    users.push({
      id: googleUserId,
      email: 'verified@irontrack.local',
      passwordHash: await hash('existing-password-hash-source', 12),
      authProvider: 'GOOGLE',
      deletedAt: null,
      googleId: 'google-user-id-123',
    });
    (prismaMock.user.update as jest.Mock).mockResolvedValueOnce({
      id: googleUserId,
      email: 'verified@irontrack.local',
      passwordHash: 'hash',
      authProvider: 'LOCAL',
      deletedAt: null,
      googleId: 'google-user-id-123',
    });

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_REGISTERED_WITH_PASSWORD',
      },
    });
  });

  it('rethrows non-email create uniqueness errors during google login', async () => {
    const nonEmailUniqueViolation = Object.assign(
      new Error('Unique constraint failed'),
      {
        code: 'P2002',
        meta: { target: ['googleId'] },
      },
    );
    (prismaMock.user.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      nonEmailUniqueViolation,
    );

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toBe(nonEmailUniqueViolation);
  });

  it('rethrows create conflict when concurrent user cannot be loaded', async () => {
    const emailUniqueViolation = Object.assign(
      new Error('Unique constraint failed'),
      {
        code: 'P2002',
        meta: { target: ['email'] },
      },
    );
    (prismaMock.user.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      emailUniqueViolation,
    );

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toBe(emailUniqueViolation);
  });

  it('rejects google login when concurrent account is soft-deleted', async () => {
    (prismaMock.user.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: randomUUID(),
        email: 'verified@irontrack.local',
        passwordHash: 'hash',
        authProvider: 'GOOGLE',
        deletedAt: new Date('2026-03-05T00:00:00.000Z'),
      });
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'USER_DISABLED',
      },
    });
  });

  it('recovers google login by updating concurrent GOOGLE account after email race', async () => {
    const concurrentGoogleId = randomUUID();
    const concurrentGoogleUser = {
      id: concurrentGoogleId,
      email: 'verified@irontrack.local',
      passwordHash: 'hash',
      authProvider: 'GOOGLE' as const,
      deletedAt: null,
      googleId: 'stale-google-id',
      name: 'Old Name',
      avatarUrl: 'https://example.com/old.png',
    };
    users.push(concurrentGoogleUser);
    (prismaMock.user.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentGoogleUser);
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] },
      }),
    );

    const tokens = await authService.googleLogin({
      idToken: 'valid-google-id-token-1234567890',
    });

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: concurrentGoogleId },
      data: {
        authProvider: 'GOOGLE',
        googleId: 'google-user-id-123',
        name: 'Verified User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
  });

  it('applies UTC timezone when creating google-auth users', async () => {
    await authService.googleLogin({
      idToken: 'valid-google-id-token-1234567890',
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timezone: 'UTC',
        }),
      }),
    );
  });

  it('stores a random high-cost sentinel password hash for new google users', async () => {
    await authService.googleLogin({
      idToken: 'valid-google-id-token-1234567890',
    });

    const createArgs = (prismaMock.user.create as jest.Mock).mock
      .calls[0]?.[0] as UserCreateArgs | undefined;
    const createPasswordHash = createArgs?.data.passwordHash;

    expect(typeof createPasswordHash).toBe('string');
    expect(
      await bcryptjs.compare('google-user-id-123', createPasswordHash!),
    ).toBe(false);
    expect(bcryptjs.getRounds(createPasswordHash!)).toBe(12);
  });

  it('does not compute a new password hash for returning GOOGLE users', async () => {
    users.push({
      id: randomUUID(),
      email: 'verified@irontrack.local',
      passwordHash: await hash('existing-password-hash-source', 12),
      authProvider: 'GOOGLE',
      deletedAt: null,
      googleId: 'google-user-id-123',
    });
    const hashMock = bcryptjs.hash as unknown as jest.Mock;
    hashMock.mockClear();

    await authService.googleLogin({
      idToken: 'valid-google-id-token-1234567890',
    });

    expect(hashMock).not.toHaveBeenCalled();
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
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
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
        meta: { target: ['email'] },
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

  it('does not remap non-email unique constraint errors to EMAIL_TAKEN', async () => {
    const nonEmailUniqueViolation = Object.assign(
      new Error('Unique constraint failed'),
      {
        code: 'P2002',
        meta: { target: ['googleId'] },
      },
    );
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      nonEmailUniqueViolation,
    );

    await expect(
      authService.register({
        email: 'not-email-unique@example.com',
        password: 'Str0ngPassword!',
        name: 'Not Email Unique',
      }),
    ).rejects.toBe(nonEmailUniqueViolation);
  });

  it('maps email unique violations when Prisma target is a constraint-name string', async () => {
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: 'User_email_key' },
      }),
    );

    await expect(
      authService.register({
        email: 'constraint-string@example.com',
        password: 'Str0ngPassword!',
        name: 'Constraint String',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_TAKEN',
      },
    });
  });

  it('rethrows non-object registration create errors', async () => {
    (prismaMock.user.create as jest.Mock).mockRejectedValueOnce('boom');

    await expect(
      authService.register({
        email: 'non-object-error@example.com',
        password: 'Str0ngPassword!',
        name: 'Non Object',
      }),
    ).rejects.toBe('boom');
  });

  it('checks registration email availability against active users', async () => {
    await authService.register({
      email: 'active-check@example.com',
      password: 'Str0ngPassword!',
      name: 'Active Check',
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'active-check@example.com',
        deletedAt: null,
      },
    });
  });

  it('rejects login when user is missing', async () => {
    await expect(
      authService.login({
        email: 'missing@example.com',
        password: 'Str0ngPassword!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('runs bcrypt compare even when login user is missing', async () => {
    const compareMock = bcryptjs.compare as unknown as jest.Mock;

    await expect(
      authService.login({
        email: 'timing-missing@example.com',
        password: 'Str0ngPassword!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compareMock).toHaveBeenCalledTimes(1);
  });

  it('runs bcrypt compare even for GOOGLE accounts to reduce timing side-channel', async () => {
    users.push({
      id: randomUUID(),
      email: 'google-only@example.com',
      passwordHash: await hash('irrelevant-password', 12),
      authProvider: 'GOOGLE',
    });
    const compareMock = bcryptjs.compare as unknown as jest.Mock;

    await expect(
      authService.login({
        email: 'google-only@example.com',
        password: 'Str0ngPassword!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(compareMock).toHaveBeenCalledTimes(1);
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
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects google login when account becomes soft-deleted before token issuance', async () => {
    const userId = randomUUID();
    (prismaMock.user.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prismaMock.user.create as jest.Mock).mockResolvedValueOnce({
      id: userId,
      email: 'verified@irontrack.local',
      passwordHash: 'hash',
      authProvider: 'GOOGLE',
      deletedAt: new Date('2026-03-05T00:00:00.000Z'),
      googleId: 'google-user-id-123',
      name: 'Verified User',
      avatarUrl: 'https://example.com/avatar.png',
    });

    await expect(
      authService.googleLogin({
        idToken: 'valid-google-id-token-1234567890',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
