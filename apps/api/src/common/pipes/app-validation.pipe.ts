import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

type ValidationIssue = {
  path: string;
  message: string;
};

export function createAppValidationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidUnknownValues: false,
    exceptionFactory: (errors: ValidationError[] = []) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: flattenValidationErrors(errors),
      }),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationIssue[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const currentIssues = Object.values(error.constraints ?? {}).map(
      (message) => ({
        path,
        message,
      }),
    );

    return currentIssues.concat(
      flattenValidationErrors(error.children ?? [], path),
    );
  });
}
