import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { firstValueFrom, of } from 'rxjs';

import { CorrelationIdInterceptor } from './correlation-id.interceptor';

function createExecutionContext(headerValue?: string | string[]): {
  context: ExecutionContext;
  request: Request;
  response: Response;
  setHeader: jest.Mock;
} {
  const headers: Request['headers'] = {};
  if (headerValue !== undefined) {
    headers['x-correlation-id'] = headerValue;
  }

  const request = { headers } as Request;
  const setHeader = jest.fn();
  const response = { setHeader } as unknown as Response;

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;

  return { context, request, response, setHeader };
}

describe('CorrelationIdInterceptor', () => {
  const interceptor = new CorrelationIdInterceptor();
  const next: CallHandler = {
    handle: () => of('ok'),
  };

  it('uses client-provided correlation id when non-empty', async () => {
    const { context, request, setHeader } = createExecutionContext('abc-123');

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('ok');
    expect(request.headers['x-correlation-id']).toBe('abc-123');
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'abc-123');
  });

  it('generates correlation id when header is empty or whitespace', async () => {
    const { context, request, setHeader } = createExecutionContext('   ');

    await firstValueFrom(interceptor.intercept(context, next));

    const correlationId = request.headers['x-correlation-id'];
    expect(typeof correlationId).toBe('string');
    expect((correlationId as string).length).toBeGreaterThan(0);
    expect(correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', correlationId);
  });

  it('uses first correlation id value when header is an array', async () => {
    const { context, request, setHeader } = createExecutionContext([
      'first-id',
      'second-id',
    ]);

    await firstValueFrom(interceptor.intercept(context, next));

    expect(request.headers['x-correlation-id']).toBe('first-id');
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'first-id');
  });
});
