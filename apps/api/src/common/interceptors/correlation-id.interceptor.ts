import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const headerValue = request.headers['x-correlation-id'];
    const normalizedHeaderValue = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    const correlationId =
      typeof normalizedHeaderValue === 'string' &&
      normalizedHeaderValue.trim().length > 0
        ? normalizedHeaderValue.trim()
        : randomUUID();

    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    return next.handle();
  }
}
