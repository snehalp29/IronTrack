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
    applySessionSuperset: jest.fn(),
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

  it('routes session creation to startSession', async () => {
    (sessionsServiceMock.startSession as jest.Mock).mockResolvedValueOnce({
      id: 'session-1',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/sessions')
      .send({
        notes: 'Push day',
        exercises: [],
      });

    expect(response.status).toBe(201);
    expect(sessionsServiceMock.startSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ notes: 'Push day' }),
    );
  });

  it('routes active session reads to getActiveSession', async () => {
    (sessionsServiceMock.getActiveSession as jest.Mock).mockResolvedValueOnce({
      id: 'session-1',
    });

    const response = await request(app.getHttpServer()).get(
      '/api/v1/sessions/active',
    );

    expect(response.status).toBe(200);
    expect(sessionsServiceMock.getActiveSession).toHaveBeenCalledWith('user-1');
  });

  it('routes session finishing to finishSession', async () => {
    (sessionsServiceMock.finishSession as jest.Mock).mockResolvedValueOnce({
      id: 'session-1',
    });

    const response = await request(app.getHttpServer()).post(
      '/api/v1/sessions/session-1/finish',
    );

    expect(response.status).toBe(200);
    expect(sessionsServiceMock.finishSession).toHaveBeenCalledWith(
      'user-1',
      'session-1',
    );
  });

  it('routes session deletion to softDeleteSession', async () => {
    const response = await request(app.getHttpServer()).delete(
      '/api/v1/sessions/session-1',
    );

    expect(response.status).toBe(204);
    expect(sessionsServiceMock.softDeleteSession).toHaveBeenCalledWith(
      'user-1',
      'session-1',
    );
  });

  it('routes session listing to listSessions with validated query params', async () => {
    (sessionsServiceMock.listSessions as jest.Mock).mockResolvedValueOnce({
      items: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .query({ page: 1, pageSize: 10, status: 'FINISHED' });

    expect(response.status).toBe(200);
    expect(sessionsServiceMock.listSessions).toHaveBeenCalledWith('user-1', {
      page: 1,
      pageSize: 10,
      status: 'FINISHED',
    });
  });

  it('routes exercise swaps to swapSessionExercise', async () => {
    (
      sessionsServiceMock.swapSessionExercise as jest.Mock
    ).mockResolvedValueOnce({ id: 'session-1' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/sessions/session-1/exercises/swap')
      .send({
        fromExerciseId: '11111111-1111-4111-8111-111111111111',
        toExerciseTemplateId: '22222222-2222-4222-8222-222222222222',
      });

    expect(response.status).toBe(201);
    expect(sessionsServiceMock.swapSessionExercise).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      {
        fromExerciseId: '11111111-1111-4111-8111-111111111111',
        toExerciseTemplateId: '22222222-2222-4222-8222-222222222222',
      },
    );
  });

  it('routes superset updates to applySessionSuperset', async () => {
    (
      sessionsServiceMock.applySessionSuperset as jest.Mock
    ).mockResolvedValueOnce({ id: 'session-1' });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/sessions/session-1/exercises/superset')
      .send({
        exerciseIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      });

    expect(response.status).toBe(200);
    expect(sessionsServiceMock.applySessionSuperset).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      {
        exerciseIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      },
    );
  });
});
