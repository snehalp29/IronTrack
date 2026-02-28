import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';

import { AuthModule } from '../src/modules/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const users: any[] = [];
  const refreshTokens: any[] = [];

  const prismaMock = {
    user: {
      findUnique: jest.fn(
        async ({ where }: any) =>
          users.find((user) =>
            where.id ? user.id === where.id : user.email === where.email,
          ) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: randomUUID(),
          email: data.email,
          passwordHash: data.passwordHash,
          authProvider: data.authProvider ?? 'LOCAL',
          timezone: data.timezone,
          unitPreference: data.unitPreference,
          name: data.name,
          avatarUrl: data.avatarUrl,
        };
        users.push(created);
        return created;
      }),
      upsert: jest.fn(async ({ where, update, create }: any) => {
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
          googleId: create.googleId,
          name: create.name,
          avatarUrl: create.avatarUrl,
        };
        users.push(created);
        return created;
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: any) => {
        refreshTokens.push({ id: randomUUID(), ...data, revokedAt: null });
      }),
      findFirst: jest.fn(async ({ where, include }: any) => {
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
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const token = refreshTokens.find((item) => item.id === where.id);
        if (token) {
          token.revokedAt = data.revokedAt;
        }
        return token;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
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
      }),
    },
  };

  beforeEach(async () => {
    users.length = 0;
    refreshTokens.length = 0;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_ACCESS_SECRET: 'access-secret-1234567890',
              JWT_REFRESH_SECRET: 'refresh-secret-1234567890',
              JWT_ACCESS_EXPIRY: '15m',
              JWT_REFRESH_EXPIRY: '7d',
              GOOGLE_CLIENT_ID: '',
              GOOGLE_CLIENT_SECRET: '',
              GOOGLE_CALLBACK_URL: '',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('register -> login -> refresh -> logout', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'e2e@example.com',
        password: 'Str0ngPassword!',
        name: 'E2E User',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.accessToken).toBeTruthy();
    expect(registerRes.body.refreshToken).toBeTruthy();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'e2e@example.com',
        password: 'Str0ngPassword!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.refreshToken).toBeTruthy();

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: loginRes.body.refreshToken,
      });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({
        refreshToken: refreshRes.body.refreshToken,
      });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
  });
});
