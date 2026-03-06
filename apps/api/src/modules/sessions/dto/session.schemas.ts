import { z } from 'zod';

import { optionalTrimmed } from '../../../common/validation/optional-trimmed';

const MAX_INLINE_SESSION_EXERCISES = 200;
const MAX_BATCH_SET_COUNT = 100;
const MAX_SESSION_LIST_RANGE_DAYS = 366;
const MAX_SET_PAYLOAD_SERIALIZED_LENGTH = 4000;

const optionalSupersetGroupKeySchema = optionalTrimmed(z.string());

const optionalNullableSupersetGroupKeySchema = optionalTrimmed(
  z.string().nullable(),
);

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(100),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const setPayloadSchema = z
  .record(z.string(), jsonValueSchema)
  .superRefine((payload, ctx) => {
    if (JSON.stringify(payload).length > MAX_SET_PAYLOAD_SERIALIZED_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `payload must serialize to at most ${MAX_SET_PAYLOAD_SERIALIZED_LENGTH} characters`,
      });
    }
  });

export const startSessionSchema = z
  .object({
    workoutTemplateId: z.string().uuid().optional(),
    notes: z.string().max(4000).optional(),
    exercises: z
      .array(
        z.object({
          exerciseTemplateId: z.string().uuid(),
          orderIndex: z.number().int().nonnegative().optional(),
          notes: z.string().optional(),
          supersetGroupKey: optionalSupersetGroupKeySchema,
        }),
      )
      .max(MAX_INLINE_SESSION_EXERCISES)
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (value.workoutTemplateId && value.exercises.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Provide either workoutTemplateId or inline exercises, but not both',
        path: ['exercises'],
      });
    }
  });

export const updateSessionSchema = z.object({
  notes: z.string().max(4000).optional(),
  endedReason: z.enum(['USER_ENDED', 'AUTO_TIMEOUT']).optional(),
  version: z.number().int().positive(),
});

export const listSessionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    templateId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate || !value.endDate) {
      return;
    }

    const start = new Date(value.startDate);
    const end = new Date(value.endDate);
    if (end < start) {
      ctx.addIssue({
        code: 'custom',
        message: 'endDate must be greater than or equal to startDate',
        path: ['endDate'],
      });
      return;
    }

    const rangeMs = end.getTime() - start.getTime();
    const maxRangeMs = MAX_SESSION_LIST_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (rangeMs > maxRangeMs) {
      ctx.addIssue({
        code: 'custom',
        message: `date range must not exceed ${MAX_SESSION_LIST_RANGE_DAYS} days`,
        path: ['endDate'],
      });
    }
  });

export const addSessionExerciseSchema = z.object({
  exerciseTemplateId: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  notes: z.string().optional(),
  supersetGroupKey: optionalSupersetGroupKeySchema,
});

export const updateSessionExerciseSchema = z.object({
  notes: z.string().optional(),
  supersetGroupKey: optionalNullableSupersetGroupKeySchema,
  orderIndex: z.number().int().nonnegative().optional(),
  version: z.number().int().positive().optional(),
});

const reorderSessionExerciseItemSchema = z.object({
  id: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
});

export const reorderSessionExercisesSchema = z.object({
  items: z
    .array(reorderSessionExerciseItemSchema)
    .min(1)
    .superRefine((items, ctx) => {
      const seenIds = new Set<string>();
      const seenOrderIndexes = new Set<number>();

      for (const [index, item] of items.entries()) {
        if (seenIds.has(item.id)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Duplicate exercise id in reorder payload',
            path: [index, 'id'],
          });
        }
        seenIds.add(item.id);

        if (seenOrderIndexes.has(item.orderIndex)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Duplicate orderIndex in reorder payload',
            path: [index, 'orderIndex'],
          });
        }
        seenOrderIndexes.add(item.orderIndex);
      }
    }),
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
  payload: setPayloadSchema,
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
      code: 'custom',
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
  sets: z.array(createSetSchema).min(1).max(MAX_BATCH_SET_COUNT),
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
