import {
  GatewayTimeoutException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';

import { MlClientService } from './ml-client.service';

describe('MlClientService', () => {
  const createService = (mlUrl?: string | null) => {
    const httpService = {
      get: jest.fn(),
      post: jest.fn(),
    };

    const configService = {
      get: jest.fn().mockReturnValue(mlUrl as string | undefined),
    };

    return {
      service: new MlClientService(
        httpService as never,
        configService as never,
      ),
      httpService,
    };
  };

  it('falls back to localhost when ML_SERVICE_URL is undefined', async () => {
    const { service, httpService } = createService(undefined);
    httpService.get.mockReturnValue(of({ data: { ok: true } }));

    await expect(service.health()).resolves.toEqual({ ok: true });
    expect(httpService.get.mock.calls[0]?.[0]).toBe(
      'http://localhost:5000/health',
    );
  });

  it('falls back to localhost when ML_SERVICE_URL is blank', async () => {
    const { service, httpService } = createService('   ');
    httpService.get.mockReturnValue(of({ data: { ok: true } }));

    await expect(service.health()).resolves.toEqual({ ok: true });
    expect(httpService.get.mock.calls[0]?.[0]).toBe(
      'http://localhost:5000/health',
    );
  });

  it('calls each ML endpoint and returns response data', async () => {
    const { service, httpService } = createService('https://ml.example.com');
    httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
    httpService.post
      .mockReturnValueOnce(of({ data: { load: 100 } }))
      .mockReturnValueOnce(of({ data: { seconds: 120 } }))
      .mockReturnValueOnce(of({ data: { pattern: 'overuse' } }))
      .mockReturnValueOnce(of({ data: { session: 'A' } }));

    await expect(service.health()).resolves.toEqual({ status: 'ok' });
    await expect(service.nextLoad({ x: 1 })).resolves.toEqual({ load: 100 });
    await expect(service.restTime({ x: 2 })).resolves.toEqual({ seconds: 120 });
    await expect(service.painPattern({ x: 3 })).resolves.toEqual({
      pattern: 'overuse',
    });
    await expect(service.sessionRecommender({ x: 4 })).resolves.toEqual({
      session: 'A',
    });

    expect(httpService.get.mock.calls[0]?.[0]).toBe(
      'https://ml.example.com/health',
    );
    expect(httpService.post.mock.calls[0]?.slice(0, 2)).toEqual([
      'https://ml.example.com/api/v1/next-load',
      { x: 1 },
    ]);
    expect(httpService.post.mock.calls[1]?.slice(0, 2)).toEqual([
      'https://ml.example.com/api/v1/rest-time',
      { x: 2 },
    ]);
    expect(httpService.post.mock.calls[2]?.slice(0, 2)).toEqual([
      'https://ml.example.com/api/v1/pain-pattern',
      { x: 3 },
    ]);
    expect(httpService.post.mock.calls[3]?.slice(0, 2)).toEqual([
      'https://ml.example.com/api/v1/session-recommender',
      { x: 4 },
    ]);
  });

  it('normalizes trailing slash in ML_SERVICE_URL', async () => {
    const { service, httpService } = createService('https://ml.example.com/');
    httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));

    await expect(service.health()).resolves.toEqual({ status: 'ok' });
    expect(httpService.get.mock.calls[0]?.[0]).toBe(
      'https://ml.example.com/health',
    );
  });

  it('strips repeated trailing slashes from ML_SERVICE_URL', async () => {
    const { service, httpService } = createService('https://ml.example.com///');
    httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));

    await expect(service.health()).resolves.toEqual({ status: 'ok' });
    expect(httpService.get.mock.calls[0]?.[0]).toBe(
      'https://ml.example.com/health',
    );
  });

  it('applies a timeout to ML requests', async () => {
    const { service, httpService } = createService('https://ml.example.com');
    httpService.get.mockReturnValue(of({ data: { status: 'ok' } }));
    httpService.post.mockReturnValue(of({ data: { load: 100 } }));

    await service.health();
    await service.nextLoad({ x: 1 });

    expect(httpService.get.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ timeout: 5000 }),
    );
    expect(httpService.post.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('maps upstream 4xx validation errors to 422 responses', async () => {
    const { service, httpService } = createService('https://ml.example.com');
    httpService.post.mockReturnValue(
      throwError(() => ({
        response: {
          status: 422,
          data: { detail: 'bad payload' },
        },
      })),
    );

    await expect(service.nextLoad({ x: 1 })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('maps ML timeouts to gateway timeout responses', async () => {
    const { service, httpService } = createService('https://ml.example.com');
    httpService.post.mockReturnValue(
      throwError(() => ({
        code: 'ECONNABORTED',
      })),
    );

    await expect(service.restTime({ x: 1 })).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });
});
