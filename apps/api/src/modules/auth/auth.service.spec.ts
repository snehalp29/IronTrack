import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

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

  beforeEach(async () => {
    users.length = 0;
    refreshTokens.length = 0;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
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
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
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
});
