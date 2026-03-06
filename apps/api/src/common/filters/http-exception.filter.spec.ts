import { HttpException, HttpStatus } from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = (request: {
    method: string;
    url: string;
    headers?: Record<string, unknown>;
  }) => {
    const normalizedRequest = {
      ...request,
      headers: request.headers ?? {},
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => normalizedRequest,
        getResponse: () => response,
      }),
    };

    return { host, response };
  };

  it('handles unknown errors as 500 and logs stack', () => {
    const filter = new HttpExceptionFilter();
    const loggerError = jest
      .spyOn(
        (filter as never as { logger: { error: (...args: unknown[]) => void } })
          .logger,
        'error',
      )
      .mockImplementation();

    const error = new Error('boom');
    const { host, response } = createHost({ method: 'GET', url: '/x' });

    filter.catch(error, host as never);

    expect(loggerError).toHaveBeenCalledWith(
      'Unhandled error for GET /x',
      error.stack,
    );
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.any(String),
    );
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('handles non-Error unknown exceptions with undefined stack', () => {
    const filter = new HttpExceptionFilter();
    const loggerError = jest
      .spyOn(
        (filter as never as { logger: { error: (...args: unknown[]) => void } })
          .logger,
        'error',
      )
      .mockImplementation();

    const { host, response } = createHost({ method: 'GET', url: '/x' });

    filter.catch('boom', host as never);

    expect(loggerError).toHaveBeenCalledWith(
      'Unhandled error for GET /x',
      undefined,
    );
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  it('logs request paths without query strings', () => {
    const filter = new HttpExceptionFilter();
    const loggerError = jest
      .spyOn(
        (filter as never as { logger: { error: (...args: unknown[]) => void } })
          .logger,
        'error',
      )
      .mockImplementation();

    const { host } = createHost({
      method: 'GET',
      url: '/x?token=secret&search=bench',
    });

    filter.catch(new Error('boom'), host as never);

    expect(loggerError).toHaveBeenCalledWith(
      'Unhandled error for GET /x',
      expect.any(String),
    );
  });

  it('maps HttpException object response fields', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'POST', url: '/items' });

    const exception = new HttpException(
      {
        code: 'BAD_INPUT',
        message: 'Invalid data',
        details: [{ field: 'name' }],
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: 'Invalid data',
        details: [{ field: 'name' }],
      },
    });
  });

  it('adds a correlation id header when handling HttpExceptions before interceptors run', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'GET', url: '/items' });

    filter.catch(
      new HttpException('failed', HttpStatus.BAD_REQUEST),
      host as never,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.any(String),
    );
  });

  it('normalizes HttpException array message into a string', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'POST', url: '/items' });

    const exception = new HttpException(
      {
        code: 'BAD_INPUT',
        message: ['email is invalid', 'password is too short'],
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: 'email is invalid; password is too short',
        details: undefined,
      },
    });
  });

  it('normalizes mixed-type array messages into strings', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'POST', url: '/items' });

    const exception = new HttpException(
      {
        code: 'BAD_INPUT',
        message: [
          'email is invalid',
          { field: 'password', error: 'too short' },
        ],
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: 'email is invalid; {"field":"password","error":"too short"}',
        details: undefined,
      },
    });
  });

  it('normalizes HttpException object message into a JSON string', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'POST', url: '/items' });

    const exception = new HttpException(
      {
        code: 'BAD_INPUT',
        message: { field: 'email', error: 'invalid' },
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: '{"field":"email","error":"invalid"}',
        details: undefined,
      },
    });
  });

  it('does not throw when message normalization hits a circular object', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'POST', url: '/items' });
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(() =>
      filter.catch(
        new HttpException(
          {
            code: 'BAD_INPUT',
            message: circular,
          },
          HttpStatus.BAD_REQUEST,
        ),
        host as never,
      ),
    ).not.toThrow();

    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: '[Unserializable]',
        details: undefined,
      },
    });
  });

  it('does not throw when details normalization hits a circular object', () => {
    const filter = new HttpExceptionFilter();
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      json: jest.fn((payload: unknown) => JSON.stringify(payload)),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', url: '/items', headers: {} }),
        getResponse: () => response,
      }),
    };

    expect(() =>
      filter.catch(
        new HttpException(
          {
            code: 'BAD_INPUT',
            message: 'Invalid data',
            details: circular,
          },
          HttpStatus.BAD_REQUEST,
        ),
        host as never,
      ),
    ).not.toThrow();

    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: 'Invalid data',
        details: '[Unserializable]',
      },
    });
  });

  it('normalizes non-string primitive messages', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'POST', url: '/items' });

    const exception = new HttpException(
      {
        code: 'BAD_INPUT',
        message: 123,
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_INPUT',
        message: '123',
        details: undefined,
      },
    });
  });

  it('maps non-5xx HttpException string responses', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'GET', url: '/items' });

    const exception = new HttpException('failed', HttpStatus.BAD_REQUEST);
    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_ERROR',
        message: 'failed',
      },
    });
  });

  it('masks object-based 500 HttpExceptions instead of echoing internal details', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'GET', url: '/items' });

    filter.catch(
      new HttpException(
        {
          code: 'DB_DOWN',
          message: 'database offline',
          details: { stack: 'secret' },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('masks string-based 500 HttpExceptions instead of echoing internal details', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'GET', url: '/items' });

    filter.catch(
      new HttpException('database offline', HttpStatus.INTERNAL_SERVER_ERROR),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('maps HttpException numeric response by coercing to string', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'GET', url: '/items' });

    const exception = new HttpException(123 as never, HttpStatus.BAD_REQUEST);
    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_ERROR',
        message: '123',
      },
    });
  });

  it('defaults code/message for object responses missing those fields', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'GET', url: '/items' });

    const exception = new HttpException({ details: { field: 'x' } }, 422);
    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_ERROR',
        message: exception.message,
        details: { field: 'x' },
      },
    });
  });
});
