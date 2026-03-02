import { z } from 'zod';

export const weeklyProgressQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type WeeklyProgressQueryDto = z.infer<typeof weeklyProgressQuerySchema>;
