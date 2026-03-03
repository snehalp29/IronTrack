import { z } from 'zod';

import { optionalTrimmed } from '../../../common/validation/optional-trimmed';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: optionalTrimmed(z.string().min(1).max(120)),
  timezone: optionalTrimmed(z.string().max(120)),
  unitPreference: z.enum(['METRIC', 'IMPERIAL']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(20),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type GoogleAuthDto = z.infer<typeof googleAuthSchema>;
