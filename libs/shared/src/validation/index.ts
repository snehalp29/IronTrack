import { z } from 'zod';

export const emailSchema = z.string().email();

export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, 'Password must include at least one uppercase character')
  .regex(/[a-z]/, 'Password must include at least one lowercase character')
  .regex(/[0-9]/, 'Password must include at least one number');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
