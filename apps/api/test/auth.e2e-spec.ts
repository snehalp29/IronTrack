import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { GoogleTokenVerifierService } from '../src/modules/auth/google-token-verifier.service';
import { PrismaService } from '../src/prisma/prisma.service';

function applySelect<T extends Record<string, unknown>>(
  record: T | null,
  select?: Record<string, unknown>,
): T | Record<string, unknown> | null {
  if (!record || !select) {
    return record;
  }

  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) {
      continue;
    }

    const currentValue = record[key];
    if (value === true) {
      projected[key] = currentValue;
      continue;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'select' in value &&
      typeof currentValue === 'object' &&
      currentValue !== null &&
      !Array.isArray(currentValue)
    ) {
      projected[key] = applySelect(
        currentValue as Record<string, unknown>,
        (value as { select: Record<string, unknown> }).select,
      );
    }
  }

  return projected;
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;

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
    select?: Record<string, unknown>;
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
  type UserUpdateArgs = {
    where: { id: string };
    data: Partial<UserRecord>;
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
      userId?: string;
      revokedAt: null;
      expiresAt?: { gt: Date };
    };
    data: { revokedAt: Date };
  };
  type PrismaMock = {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      upsert: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    exerciseTemplate: {
      updateMany: jest.Mock;
    };
    workoutTemplate: {
      updateMany: jest.Mock;
    };
    workoutSession: {
      updateMany: jest.Mock;
    };
    exerciseNote: {
      deleteMany: jest.Mock;
    };
    pRRecord: {
      deleteMany: jest.Mock;
    };
    userStreak: {
      deleteMany: jest.Mock;
    };
    checklistItem: {
      deleteMany: jest.Mock;
    };
    sessionNote: {
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const users: UserRecord[] = [];
  const refreshTokens: RefreshTokenRecord[] = [];
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

  const prismaMock: PrismaMock = {
    user: {
      findUnique: jest.fn(async ({ where, select }: UserFindUniqueArgs) =>
        applySelect(
          (users.find((user) =>
            where.id ? user.id === where.id : user.email === where.email,
          ) ?? null) as Record<string, unknown> | null,
          select,
        ),
      ),
      findFirst: jest.fn(
        async ({
          where,
          select,
        }: {
          where: {
            id?: string;
            email?: string;
            deletedAt?: null;
          };
          select?: Record<string, unknown>;
        }) =>
          applySelect(
            (users.find((user) => {
              const matchesId = where.id === undefined || user.id === where.id;
              const matchesEmail =
                where.email === undefined || user.email === where.email;
              const userDeletedAt = user.deletedAt ?? null;
              const matchesDeletedAt =
                where.deletedAt === undefined ||
                userDeletedAt === where.deletedAt;
              return matchesId && matchesEmail && matchesDeletedAt;
            }) ?? null) as Record<string, unknown> | null,
            select,
          ),
      ),
      create: jest.fn(async ({ data }: UserCreateArgs) => {
        const created = {
          id: randomUUID(),
          email: data.email,
          passwordHash: data.passwordHash,
          authProvider: data.authProvider ?? 'LOCAL',
          deletedAt: null,
          timezone: data.timezone,
          unitPreference: data.unitPreference,
          googleId: data.googleId,
          name: data.name,
          avatarUrl: data.avatarUrl,
        };
        users.push(created);
        return created;
      }),
      update: jest.fn(async ({ where, data }: UserUpdateArgs) => {
        const existing = users.find((user) => user.id === where.id);
        if (!existing) {
          throw new Error('User not found');
        }
        Object.assign(existing, data);
        return existing;
      }),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: {
            id?: string;
            deletedAt?: null;
          };
          data: Partial<UserRecord>;
        }) => {
          let count = 0;
          for (const user of users) {
            if (
              (where.id === undefined || user.id === where.id) &&
              (where.deletedAt === undefined ||
                (user.deletedAt ?? null) === where.deletedAt)
            ) {
              Object.assign(user, data);
              count += 1;
            }
          }
          return { count };
        },
      ),
      upsert: jest.fn(async ({ where, update, create }: UserUpsertArgs) => {
        const existing = users.find((user) => user.email === where.email);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = {
          id: randomUUID(),
          email: create.email,
          passwordHash: create.passwordHash,
          authProvider: create.authProvider ?? 'GOOGLE',
          deletedAt: null,
          googleId: create.googleId,
          name: create.name,
          avatarUrl: create.avatarUrl,
        };
        users.push(created);
        return created;
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: RefreshTokenCreateArgs) => {
        refreshTokens.push({ id: randomUUID(), ...data, revokedAt: null });
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
          return include?.user
            ? { ...token, user: users.find((user) => user.id === token.userId) }
            : token;
        },
      ),
      update: jest.fn(async ({ where, data }: RefreshTokenUpdateArgs) => {
        const token = refreshTokens.find((item) => item.id === where.id);
        if (token) {
          token.revokedAt = data.revokedAt;
        }
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
              (where.userId === undefined || token.userId === where.userId) &&
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
    exerciseTemplate: {
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    workoutTemplate: {
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    workoutSession: {
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    exerciseNote: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    pRRecord: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    userStreak: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    checklistItem: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    sessionNote: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    $transaction: jest.fn(
      async (callback: (tx: Omit<PrismaMock, '$transaction'>) => unknown) =>
        callback(prismaMock),
    ),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/irontrack_test?schema=public';
    process.env.JWT_ACCESS_SECRET = 'access-secret-1234567890';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret-1234567890';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GOOGLE_CALLBACK_URL =
      'http://localhost:3000/api/v1/auth/google/callback';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(GoogleTokenVerifierService)
      .useValue(googleTokenVerifierMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    users.length = 0;
    refreshTokens.length = 0;
    googleTokenVerifierMock.verifyIdToken.mockReset();
    googleTokenVerifierMock.verifyIdToken.mockImplementation(
      async (idToken: string) => {
        if (idToken !== 'valid-google-id-token-1234567890') {
          throw new UnauthorizedException({
            code: 'INVALID_GOOGLE_TOKEN',
            message: 'Google token is invalid',
          });
        }

        return {
          email: 'google-user@irontrack.local',
          googleId: 'google-sub-123',
          name: 'Google User',
          avatarUrl: 'https://example.com/avatar.png',
        };
      },
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('prisma mock helpers respect explicit select projections', async () => {
    users.push({
      id: 'user-select-1',
      email: 'select@example.com',
      passwordHash: 'hashed-password',
      authProvider: 'LOCAL',
      deletedAt: null,
      timezone: 'UTC',
      unitPreference: 'METRIC',
      name: 'Projection User',
    });

    await expect(
      prismaMock.user.findFirst({
        where: {
          email: 'select@example.com',
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
        },
      }),
    ).resolves.toEqual({
      id: 'user-select-1',
      email: 'select@example.com',
    });
  });

  it('logout succeeds without bearer token when refresh token cookie is provided', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', ['irontrack_refresh_token=missing-token-12345'])
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('register -> login -> refresh -> logout', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'e2e@example.com',
        password: 'Str0ngPassword!',
        name: 'E2E User',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.accessToken).toBeTruthy();
    expect(registerRes.body.refreshToken).toBeUndefined();
    expect(registerRes.headers['set-cookie']?.[0]).toContain(
      'irontrack_refresh_token=',
    );

    const agent = request.agent(app.getHttpServer());

    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'e2e@example.com',
      password: 'Str0ngPassword!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.refreshToken).toBeUndefined();
    expect(loginRes.headers['set-cookie']?.[0]).toContain(
      'irontrack_refresh_token=',
    );

    const refreshRes = await agent.post('/api/v1/auth/refresh').send({});

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    expect(refreshRes.body.refreshToken).toBeUndefined();

    const logoutRes = await agent
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
      .send({});

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.headers['set-cookie']?.[0]).toContain(
      'irontrack_refresh_token=;',
    );
  });

  it('rejects a rotated refresh token when it is reused', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'reuse@example.com',
      password: 'Str0ngPassword!',
      name: 'Reuse User',
    });

    const agent = request.agent(app.getHttpServer());
    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'reuse@example.com',
      password: 'Str0ngPassword!',
    });
    const firstRefreshCookie =
      loginRes.headers['set-cookie']?.[0]?.split(';')[0];

    const refreshRes = await agent.post('/api/v1/auth/refresh').send({});

    expect(refreshRes.status).toBe(200);
    expect(firstRefreshCookie).toBeTruthy();

    const reuseRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [firstRefreshCookie ?? ''])
      .send({});

    expect(reuseRes.status).toBe(401);
  });

  it('returns 401 for protected routes without a bearer token', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/users/me');

    expect(response.status).toBe(401);
  });

  it('soft deletes the current user and revokes refresh tokens on DELETE /api/v1/users/me', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'delete-me@example.com',
      password: 'Str0ngPassword!',
      name: 'Delete Me',
    });

    const agent = request.agent(app.getHttpServer());
    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'delete-me@example.com',
      password: 'Str0ngPassword!',
    });

    const deleteRes = await agent
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send();

    expect(deleteRes.status).toBe(204);
    expect(users[0]?.deletedAt).toBeInstanceOf(Date);
    expect(
      refreshTokens.every((token) => token.revokedAt instanceof Date),
    ).toBe(true);

    const refreshRes = await agent.post('/api/v1/auth/refresh').send({});
    expect(refreshRes.status).toBe(401);
  });

  it('google login validates id token and issues tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: 'valid-google-id-token-1234567890',
      });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.headers['set-cookie']?.[0]).toContain(
      'irontrack_refresh_token=',
    );
    expect(googleTokenVerifierMock.verifyIdToken).toHaveBeenCalledWith(
      'valid-google-id-token-1234567890',
    );
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'google-user@irontrack.local',
          googleId: 'google-sub-123',
          authProvider: 'GOOGLE',
        }),
      }),
    );
  });

  it('google login rejects invalid id token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: 'invalid-google-id-token-1234567890',
      });

    expect(response.status).toBe(401);
  });

  it('google login requires idToken payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({});

    expect(response.status).toBe(400);
  });
});
