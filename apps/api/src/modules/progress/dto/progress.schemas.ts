import { z } from 'zod';

import { isoDateOnlySchema } from '../../../common/validation/iso-date-only';

export const weeklyProgressQuerySchema = z.object({
  startDate: isoDateOnlySchema.optional(),
});

export type WeeklyProgressQueryDto = z.infer<typeof weeklyProgressQuerySchema>;
