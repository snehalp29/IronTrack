import { z } from 'zod';

import { optionalTrimmed } from '../../common/validation/optional-trimmed';
import { isValidTimezone } from '../../common/validation/timezone';

export const updateMeSchema = z.object({
  name: optionalTrimmed(z.string().min(1).max(120)),
  timezone: optionalTrimmed(
    z.string().min(1).max(120).refine(isValidTimezone, {
      message: 'Invalid timezone',
    }),
  ),
  unitPreference: z.enum(['METRIC', 'IMPERIAL']).optional(),
  avatarUrl: optionalTrimmed(
    z
      .string()
      .url()
      .refine((value) => /^https?:\/\//i.test(value), {
        message: 'avatarUrl must use http or https',
      }),
  ),
});

export type UpdateMeDto = z.infer<typeof updateMeSchema>;
