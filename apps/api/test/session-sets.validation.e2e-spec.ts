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

  it('rejects durationSeconds values above the daily bound', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/session-exercises/se-1/sets')
      .send({
        orderIndex: 0,
        type: 'DURATION',
        payload: {},
        durationSeconds: 86401,
      });

    expect(response.status).toBe(400);
    expect(sessionsServiceMock.createSet).not.toHaveBeenCalled();
  });

  it('routes valid batch set creation payloads to the sessions service', async () => {
    (sessionsServiceMock.batchCreateSets as jest.Mock).mockResolvedValueOnce([
      { id: 'set-1' },
      { id: 'set-2' },
    ]);

    const response = await request(app.getHttpServer())
      .post('/api/v1/session-exercises/se-1/sets/batch')
      .send({
        sets: [
          {
            orderIndex: 0,
            type: 'WEIGHT_REPS',
            payload: {},
            reps: 8,
            weight: 100,
            idempotencyKey: 'batch-key-1',
          },
          {
            orderIndex: 1,
            type: 'WEIGHT_REPS',
            payload: {},
            reps: 6,
            weight: 110,
            idempotencyKey: 'batch-key-2',
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(sessionsServiceMock.batchCreateSets).toHaveBeenCalledWith(
      'user-1',
      'se-1',
      expect.objectContaining({
        sets: expect.arrayContaining([
          expect.objectContaining({ idempotencyKey: 'batch-key-1' }),
          expect.objectContaining({ idempotencyKey: 'batch-key-2' }),
        ]),
      }),
    );
  });

  it('routes set updates through the updateSet endpoint', async () => {
    (sessionsServiceMock.updateSet as jest.Mock).mockResolvedValueOnce({
      id: 'set-1',
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/session-exercises/se-1/sets/set-1')
      .send({
        payload: {},
        reps: 10,
      });

    expect(response.status).toBe(200);
    expect(sessionsServiceMock.updateSet).toHaveBeenCalledWith(
      'user-1',
      'se-1',
      'set-1',
      expect.objectContaining({ reps: 10 }),
    );
  });

  it('returns 204 when deleting a set', async () => {
    const response = await request(app.getHttpServer()).delete(
      '/api/v1/session-exercises/se-1/sets/set-1',
    );

    expect(response.status).toBe(204);
    expect(sessionsServiceMock.deleteSet).toHaveBeenCalledWith(
      'user-1',
      'se-1',
      'set-1',
    );
  });

  it('routes set completion toggles through the completion endpoint', async () => {
    (
      sessionsServiceMock.toggleSetCompletion as jest.Mock
    ).mockResolvedValueOnce({
      id: 'set-1',
      isCompleted: true,
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/session-exercises/se-1/sets/set-1/complete')
      .send({ isCompleted: true });

    expect(response.status).toBe(200);
    expect(sessionsServiceMock.toggleSetCompletion).toHaveBeenCalledWith(
      'user-1',
      'se-1',
      'set-1',
      { isCompleted: true },
    );
  });
});
