import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { SessionSetsController } from '../src/modules/sessions/session-sets.controller';
import { SessionsService } from '../src/modules/sessions/sessions.service';

describe('SessionSetsController validation (e2e)', () => {
  let app: INestApplication;

  const sessionsServiceMock = {
    createSet: jest.fn(async () => ({ id: 'set-1' })),
    updateSet: jest.fn(),
    deleteSet: jest.fn(),
    toggleSetCompletion: jest.fn(),
    batchCreateSets: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [SessionSetsController],
      providers: [{ provide: SessionsService, useValue: sessionsServiceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(
      (
        req: Request & { user?: { sub: string; email: string } },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { sub: 'user-1', email: 'user-1@irontrack.local' };
        next();
      },
    );

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects negative set metrics at request boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/session-exercises/se-1/sets')
      .send({
        orderIndex: 0,
        type: 'WEIGHT_REPS',
        payload: {},
        weight: -5,
      });

    expect(response.status).toBe(400);
    expect(sessionsServiceMock.createSet).not.toHaveBeenCalled();
  });
});
