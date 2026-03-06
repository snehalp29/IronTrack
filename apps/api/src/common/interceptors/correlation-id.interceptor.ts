import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

const SAFE_CORRELATION_ID_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;

function normalizeCorrelationIdCandidate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return SAFE_CORRELATION_ID_REGEX.test(normalized) ? normalized : undefined;
}

export function resolveCorrelationId(
  headerValue: string | string[] | undefined,
): string {
  const candidates = Array.isArray(headerValue) ? headerValue : [headerValue];
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCorrelationIdCandidate(candidate);
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  return randomUUID();
}

export function applyCorrelationId(
  request: Request,
  response: Response,
): string {
  const correlationId = resolveCorrelationId(
    request.headers[CORRELATION_ID_HEADER],
  );
  request.headers[CORRELATION_ID_HEADER] = correlationId;
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  return correlationId;
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    applyCorrelationId(request, response);
    return next.handle();
  }
}
