import { z } from 'zod';

import { optionalTrimmed } from '../../common/validation/optional-trimmed';

export const updateMeSchema = z.object({
  name: optionalTrimmed(z.string().min(1).max(120)),
  timezone: optionalTrimmed(z.string().min(1).max(120)),
  unitPreference: z.enum(['METRIC', 'IMPERIAL']).optional(),
  avatarUrl: optionalTrimmed(z.string().url()),
});

export type UpdateMeDto = z.infer<typeof updateMeSchema>;
