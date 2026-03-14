import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { applyCorrelationId } from '../interceptors/correlation-id.interceptor';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    applyCorrelationId(request, response);

    const defaultPayload = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };

    if (!(exception instanceof HttpException)) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Unhandled error for ${request.method} ${this.getRequestLogPath(request)}`,
        stack,
      );
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: defaultPayload });
      return;
    }

    const statusCode = exception.getStatus();
    const exceptionBody = exception.getResponse();
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Handled ${statusCode} error for ${request.method} ${this.getRequestLogPath(request)}`,
        exception.stack,
      );
      response.status(statusCode).json({ error: defaultPayload });
      return;
    }

    if (typeof exceptionBody === 'object' && exceptionBody !== null) {
      const body = exceptionBody as {
        code?: string;
        message?: unknown;
        details?: unknown;
      };
      response.status(statusCode).json({
        error: {
          code: body.code ?? 'HTTP_ERROR',
          message: this.normalizeMessage(body.message, exception.message),
          details: this.normalizeDetails(body.details),
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

  private normalizeMessage(message: unknown, fallback: string): string {
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message
        .map((value) =>
          typeof value === 'string' ? value : this.safeStringify(value),
        )
        .join('; ');
    }

    if (message === undefined || message === null) {
      return fallback;
    }

    if (typeof message === 'object') {
      return this.safeStringify(message);
    }

    return String(message);
  }

  private normalizeDetails(details: unknown): unknown {
    if (details === undefined) {
      return undefined;
    }

    if (
      details === null ||
      typeof details === 'string' ||
      typeof details === 'number' ||
      typeof details === 'boolean'
    ) {
      return details;
    }

    try {
      return JSON.parse(JSON.stringify(details));
    } catch {
      return '[Unserializable]';
    }
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Unserializable]';
    }
  }

  private getRequestLogPath(request: Request): string {
    if (typeof request.path === 'string' && request.path.length > 0) {
      return request.path;
    }

    return request.url.split('?')[0] ?? request.url;
  }
}
