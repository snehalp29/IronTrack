import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { ChecklistModule } from '../src/modules/checklist/checklist.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StreakService } from '../src/services/streak.service';

describe('ChecklistController (e2e)', () => {
  let app: INestApplication;
  let prismaMock: {
    checklistItem: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let streakServiceMock: {
    onChecklistCompleted: jest.Mock;
  };
  const originalTimezone = process.env.TZ;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = {
      checklistItem: {
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async () => ({
          id: 'check-1',
          userId: 'user-1',
          date: new Date('2024-03-10T00:00:00.000Z'),
          type: 'WORKOUT',
          isCompleted: true,
          completedAt: new Date('2024-03-10T10:00:00.000Z'),
          user: {
            timezone: 'America/New_York',
          },
        })),
        update: jest.fn(async () => ({
          id: 'check-1',
          userId: 'user-1',
          date: new Date('2024-03-10T00:00:00.000Z'),
          type: 'WORKOUT',
          isCompleted: true,
          completedAt: new Date('2024-03-10T10:00:00.000Z'),
          user: {
            timezone: 'America/New_York',
          },
        })),
      },
      $transaction: jest.fn(
        async (
          callback: (tx: {
            checklistItem: {
              findMany: jest.Mock;
              findUnique: jest.Mock;
              upsert: jest.Mock;
              update: jest.Mock;
            };
          }) => unknown,
        ) => callback(prismaMock),
      ),
    };
    streakServiceMock = {
      onChecklistCompleted: jest.fn(async () => undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ChecklistModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(StreakService)
      .useValue(streakServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(
      (
        req: Request & { user?: { sub: string; email: string } },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = {
          sub: 'user-1',
          email: 'user-1@irontrack.local',
        };
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    process.env.TZ = originalTimezone;
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/checklist/week uses an inclusive 7-day UTC window across DST boundaries', async () => {
    process.env.TZ = 'America/New_York';

    const response = await request(app.getHttpServer())
      .get('/api/v1/checklist/week')
      .query({ startDate: '2024-03-10' });

    expect(response.status).toBe(200);

    const whereDate = (prismaMock.checklistItem.findMany as jest.Mock).mock
      .calls[0][0].where.date as { gte: Date; lte: Date };

    expect(whereDate.gte.toISOString()).toBe('2024-03-10T00:00:00.000Z');
    expect(whereDate.lte.toISOString()).toBe('2024-03-16T00:00:00.000Z');
  });

  it('GET /api/v1/checklist fetches the daily checklist for the requested date', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/checklist')
      .query({ date: '2024-03-10' });

    expect(response.status).toBe(200);
    expect(prismaMock.checklistItem.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        date: new Date('2024-03-10T00:00:00.000Z'),
      },
      orderBy: { type: 'asc' },
    });
  });

  it('PUT /api/v1/checklist returns 201 when it creates a completed checklist item', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/checklist')
      .send({
        date: '2024-03-10',
        type: 'WORKOUT',
        isCompleted: true,
      });

    expect(response.status).toBe(201);
    expect(streakServiceMock.onChecklistCompleted).toHaveBeenCalledWith(
      'user-1',
      '2024-03-10',
      'America/New_York',
    );
  });

  it('rejects future checklist upserts at the request boundary', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/checklist')
      .send({
        date: '2999-01-01',
        type: 'WORKOUT',
        isCompleted: true,
      });

    expect(response.status).toBe(400);
  });

  it('rejects future checklist week windows', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/checklist/week')
      .query({ startDate: '2999-01-01' });

    expect(response.status).toBe(400);
  });
});
