import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { SessionsController } from '../src/modules/sessions/sessions.controller';
import { SessionsService } from '../src/modules/sessions/sessions.service';

describe('SessionsController routing (e2e)', () => {
  let app: INestApplication;

  const sessionsServiceMock = {
    startSession: jest.fn(),
    getActiveSession: jest.fn(),
    getSession: jest.fn(),
    updateSession: jest.fn(),
    finishSession: jest.fn(),
    listSessions: jest.fn(),
    softDeleteSession: jest.fn(),
    addSessionExercise: jest.fn(),
    updateSessionExercise: jest.fn(async () => ({ id: 'wrong-route' })),
    deleteSessionExercise: jest.fn(),
    reorderSessionExercises: jest.fn(async () => ({ success: true })),
    swapSessionExercise: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController],
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

  it('routes /exercises/reorder to reorderSessionExercises instead of updateSessionExercise', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/sessions/session-1/exercises/reorder')
      .send({
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(sessionsServiceMock.reorderSessionExercises).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
        ],
      },
    );
    expect(sessionsServiceMock.updateSessionExercise).not.toHaveBeenCalled();
  });
});
