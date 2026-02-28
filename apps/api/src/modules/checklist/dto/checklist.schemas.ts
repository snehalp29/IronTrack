import { z } from 'zod';

export const checklistQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const upsertChecklistSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['WORKOUT', 'WARMUP', 'MOBILITY', 'NOTES']),
  isCompleted: z.boolean(),
});

export const checklistWeekQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ChecklistQueryDto = z.infer<typeof checklistQuerySchema>;
export type UpsertChecklistDto = z.infer<typeof upsertChecklistSchema>;
export type ChecklistWeekQueryDto = z.infer<typeof checklistWeekQuerySchema>;
