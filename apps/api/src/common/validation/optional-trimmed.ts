import { z } from 'zod';

import { trimStringOrUndefined } from './string-normalization';

export function optionalTrimmed<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(trimStringOrUndefined, schema.optional());
}
