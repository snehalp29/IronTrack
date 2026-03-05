import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { GoogleTokenVerifierService } from '../src/modules/auth/google-token-verifier.service';
import { PrismaService } from '../src/prisma/prisma.service';

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

  const prismaMock = {
    user: {
      findUnique: jest.fn(
        async ({ where }: UserFindUniqueArgs) =>
          users.find((user) =>
            where.id ? user.id === where.id : user.email === where.email,
          ) ?? null,
      ),
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: {
            id?: string;
            email?: string;
            deletedAt?: null;
          };
        }) =>
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
        const created = {
          id: randomUUID(),
          email: data.email,
          passwordHash: data.passwordHash,
          authProvider: data.authProvider ?? 'LOCAL',
          deletedAt: null,
          timezone: data.timezone,
          unitPreference: data.unitPreference,
          name: data.name,
          avatarUrl: data.avatarUrl,
        };
        users.push(created);
        return created;
      }),
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

  beforeEach(async () => {
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
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('logout succeeds without bearer token when refresh token is provided', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({
        refreshToken: 'missing-token-12345',
      });

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
    expect(registerRes.body.refreshToken).toBeTruthy();

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'e2e@example.com',
        password: 'Str0ngPassword!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.refreshToken).toBeTruthy();

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: loginRes.body.refreshToken,
      });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();

    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
      .send({
        refreshToken: refreshRes.body.refreshToken,
      });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
  });

  it('google login validates id token and issues tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: 'valid-google-id-token-1234567890',
      });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.refreshToken).toBeTruthy();
    expect(googleTokenVerifierMock.verifyIdToken).toHaveBeenCalledWith(
      'valid-google-id-token-1234567890',
    );
    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'google-user@irontrack.local' },
        update: expect.objectContaining({
          googleId: 'google-sub-123',
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
