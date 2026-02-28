import { z } from 'zod';

export const updateMeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(120).optional(),
  unitPreference: z.enum(['METRIC', 'IMPERIAL']).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateMeDto = z.infer<typeof updateMeSchema>;
