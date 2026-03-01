import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const defaultPayload = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };

    if (!(exception instanceof HttpException)) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Unhandled error for ${request.method} ${request.url}`,
        stack,
      );
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: defaultPayload });
      return;
    }

    const statusCode = exception.getStatus();
    const exceptionBody = exception.getResponse();

    if (typeof exceptionBody === 'object' && exceptionBody !== null) {
      const body = exceptionBody as {
        code?: string;
        message?: string;
        details?: unknown;
      };
      response.status(statusCode).json({
        error: {
          code: body.code ?? 'HTTP_ERROR',
          message: body.message ?? exception.message,
          details: body.details,
        },
      });
      return;
    }

    response.status(statusCode).json({
      error: {
        code: 'HTTP_ERROR',
        message: String(exceptionBody),
      },
    });
  }
}
