import { z } from 'zod';

export const startSessionSchema = z.object({
  workoutTemplateId: z.string().uuid().optional(),
  notes: z.string().max(4000).optional(),
  exercises: z
    .array(
      z.object({
        exerciseTemplateId: z.string().uuid(),
        orderIndex: z.number().int().nonnegative().optional(),
        notes: z.string().optional(),
        supersetGroupKey: z.string().optional(),
      }),
    )
    .default([]),
});

export const updateSessionSchema = z.object({
  notes: z.string().max(4000).optional(),
  endedReason: z.enum(['USER_ENDED', 'AUTO_TIMEOUT']).optional(),
  version: z.number().int().positive(),
});

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  templateId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const addSessionExerciseSchema = z.object({
  exerciseTemplateId: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  notes: z.string().optional(),
  supersetGroupKey: z.string().optional(),
});

export const updateSessionExerciseSchema = z.object({
  notes: z.string().optional(),
  supersetGroupKey: z.string().nullable().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  version: z.number().int().positive().optional(),
});

export const reorderSessionExercisesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      orderIndex: z.number().int().nonnegative(),
    }),
  ),
});

export const swapSessionExerciseSchema = z.object({
  fromExerciseId: z.string().uuid(),
  toExerciseTemplateId: z.string().uuid(),
});

const baseCreateSetSchema = z.object({
  orderIndex: z.number().int().nonnegative(),
  type: z.enum([
    'WEIGHT_REPS',
    'BODYWEIGHT',
    'DURATION',
    'REPS_ONLY',
    'BODYWEIGHT_PLUS_WEIGHT',
  ]),
  payload: z.record(z.string(), z.unknown()),
  isCompleted: z.boolean().optional(),
  completedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().min(6).optional(),
  weight: z.number().finite().nonnegative().optional(),
  reps: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  rpe: z.number().finite().min(0).max(10).optional(),
});

const validateSetCompletionConsistency = (
  value: { isCompleted?: boolean; completedAt?: string },
  ctx: z.RefinementCtx,
) => {
  if (value.completedAt !== undefined && value.isCompleted !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'isCompleted must be true when completedAt is provided',
      path: ['isCompleted'],
    });
  }
};

export const createSetSchema = baseCreateSetSchema.superRefine(
  validateSetCompletionConsistency,
);

export const updateSetSchema = baseCreateSetSchema
  .partial()
  .superRefine(validateSetCompletionConsistency);

export const toggleSetCompletionSchema = z.object({
  isCompleted: z.boolean(),
});

export const batchCreateSetsSchema = z.object({
  sets: z.array(createSetSchema).min(1),
});

export type StartSessionDto = z.infer<typeof startSessionSchema>;
export type UpdateSessionDto = z.infer<typeof updateSessionSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;
export type AddSessionExerciseDto = z.infer<typeof addSessionExerciseSchema>;
export type UpdateSessionExerciseDto = z.infer<
  typeof updateSessionExerciseSchema
>;
export type ReorderSessionExercisesDto = z.infer<
  typeof reorderSessionExercisesSchema
>;
export type SwapSessionExerciseDto = z.infer<typeof swapSessionExerciseSchema>;
export type CreateSetDto = z.infer<typeof createSetSchema>;
export type UpdateSetDto = z.infer<typeof updateSetSchema>;
export type ToggleSetCompletionDto = z.infer<typeof toggleSetCompletionSchema>;
export type BatchCreateSetsDto = z.infer<typeof batchCreateSetsSchema>;
