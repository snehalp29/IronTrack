import { z } from 'zod';

import { isoDateOnlySchema } from '../../../common/validation/iso-date-only';

export const checklistQuerySchema = z.object({
  date: isoDateOnlySchema,
});

export const upsertChecklistSchema = z.object({
  date: isoDateOnlySchema,
  type: z.enum(['WORKOUT', 'WARMUP', 'MOBILITY', 'NOTES']),
  isCompleted: z.boolean(),
});

export const checklistWeekQuerySchema = z.object({
  startDate: isoDateOnlySchema,
});

export type ChecklistQueryDto = z.infer<typeof checklistQuerySchema>;
export type UpsertChecklistDto = z.infer<typeof upsertChecklistSchema>;
export type ChecklistWeekQueryDto = z.infer<typeof checklistWeekQuerySchema>;
