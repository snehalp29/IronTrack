import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { ChecklistModule } from '../src/modules/checklist/checklist.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ChecklistController (e2e)', () => {
  let app: INestApplication;
  const originalTimezone = process.env.TZ;

  const prismaMock = {
    checklistItem: {
      findMany: jest.fn(async () => []),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ChecklistModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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
});
