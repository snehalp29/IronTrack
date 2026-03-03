import { HttpException, HttpStatus } from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = (request: { method: string; url: string }) => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
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

  it('maps HttpException string response', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost({ method: 'GET', url: '/items' });

    const exception = new HttpException(
      'failed',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_ERROR',
        message: 'failed',
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
