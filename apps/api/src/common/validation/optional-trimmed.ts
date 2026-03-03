import { z } from 'zod';

function normalizeOptionalTrimmedValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function optionalTrimmed<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(normalizeOptionalTrimmedValue, schema.optional());
}
