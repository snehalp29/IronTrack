import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

@Injectable()
export class WinstonLoggerService implements LoggerService {
  private readonly logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: format.combine(format.timestamp(), format.json()),
    transports: [new transports.Console()],
  });

  private formatMessage(message: unknown): {
    message: string;
    details?: unknown;
  } {
    if (message instanceof Error) {
      return {
        message: message.message,
        details: {
          name: message.name,
          stack: message.stack,
        },
      };
    }

    if (typeof message === 'string') {
      return { message };
    }

    return { message: 'Non-string log message', details: message };
  }

  log(message: unknown, context?: string): void {
    const payload = this.formatMessage(message);
    this.logger.info(payload.message, { context, details: payload.details });
  }

  error(message: unknown, trace?: string, context?: string): void {
    const payload = this.formatMessage(message);
    this.logger.error(payload.message, {
      trace,
      context,
      details: payload.details,
    });
  }

  warn(message: unknown, context?: string): void {
    const payload = this.formatMessage(message);
    this.logger.warn(payload.message, { context, details: payload.details });
  }

  debug(message: unknown, context?: string): void {
    const payload = this.formatMessage(message);
    this.logger.debug(payload.message, { context, details: payload.details });
  }

  verbose(message: unknown, context?: string): void {
    const payload = this.formatMessage(message);
    this.logger.verbose(payload.message, { context, details: payload.details });
  }
}
