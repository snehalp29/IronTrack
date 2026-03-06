import { z } from 'zod';

import { optionalTrimmed } from '../../../common/validation/optional-trimmed';

const MAX_EMAIL_LENGTH = 320;
const emailSchema = z.string().email().max(MAX_EMAIL_LENGTH);

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  name: optionalTrimmed(z.string().min(1).max(120)),
  timezone: optionalTrimmed(z.string().max(120)),
  unitPreference: z.enum(['METRIC', 'IMPERIAL']).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const refreshSchema = z
  .object({})
  .strict()
  .optional()
  .transform((value) => value ?? {});

export const googleAuthSchema = z.object({
  idToken: z.string().min(20),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshRequestDto = z.infer<typeof refreshSchema>;
export interface RefreshDto {
  refreshToken: string;
}
export type GoogleAuthDto = z.infer<typeof googleAuthSchema>;
