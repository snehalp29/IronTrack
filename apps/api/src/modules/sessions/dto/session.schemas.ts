import { z } from 'zod';

import { optionalTrimmed } from '../../../common/validation/optional-trimmed';

const MAX_INLINE_SESSION_EXERCISES = 200;
const MAX_BATCH_SET_COUNT = 100;
const MAX_SESSION_LIST_RANGE_DAYS = 366;
const MAX_SESSION_EXERCISE_NOTES_LENGTH = 4000;
const MAX_SET_PAYLOAD_SERIALIZED_LENGTH = 4000;
const MAX_SET_PAYLOAD_DEPTH = 32;
const MAX_SET_PAYLOAD_ARRAY_LENGTH = 100;

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

const setPayloadSchema = z
  .unknown()
  .superRefine((payload, ctx) => {
    const validationError = validateSetPayload(payload);
    if (validationError) {
      ctx.addIssue({
        code: 'custom',
        message: validationError,
      });
    }
  })
  .transform((payload) => payload as Record<string, JsonValue>);

export const startSessionSchema = z
  .object({
    workoutTemplateId: z.string().uuid().optional(),
    notes: z.string().max(4000).optional(),
    exercises: z
      .array(
        z.object({
          exerciseTemplateId: z.string().uuid(),
          orderIndex: z.number().int().nonnegative().optional(),
          notes: z.string().max(MAX_SESSION_EXERCISE_NOTES_LENGTH).optional(),
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
    status: z.enum(['IN_PROGRESS', 'FINISHED']).optional(),
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
  notes: z.string().max(MAX_SESSION_EXERCISE_NOTES_LENGTH).optional(),
  supersetGroupKey: optionalSupersetGroupKeySchema,
});

export const updateSessionExerciseSchema = z.object({
  notes: z.string().max(MAX_SESSION_EXERCISE_NOTES_LENGTH).optional(),
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

export const applySessionSupersetSchema = z.object({
  exerciseIds: z
    .array(z.string().uuid())
    .min(2)
    .max(4)
    .superRefine((exerciseIds, ctx) => {
      const seenIds = new Set<string>();
      for (const [index, exerciseId] of exerciseIds.entries()) {
        if (seenIds.has(exerciseId)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Duplicate exercise id in superset payload',
            path: [index],
          });
        }
        seenIds.add(exerciseId);
      }
    }),
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

  if (
    value.completedAt !== undefined &&
    new Date(value.completedAt).getTime() > Date.now()
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'completedAt must not be in the future',
      path: ['completedAt'],
    });
  }
};

export const createSetSchema = baseCreateSetSchema.superRefine(
  validateSetCompletionConsistency,
);

export const updateSetSchema = baseCreateSetSchema
  .partial()
  .superRefine((value, ctx) => {
    validateSetCompletionConsistency(value, ctx);

    const updatesLoadFields =
      value.weight !== undefined ||
      value.reps !== undefined ||
      value.durationSeconds !== undefined;

    if (updatesLoadFields && value.payload === undefined) {
      ctx.addIssue({
        code: 'custom',
        message:
          'payload must be provided when weight, reps, or durationSeconds is updated',
        path: ['payload'],
      });
    }
  });

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
export type ApplySessionSupersetDto = z.infer<
  typeof applySessionSupersetSchema
>;
export type CreateSetDto = z.infer<typeof createSetSchema>;
export type UpdateSetDto = z.infer<typeof updateSetSchema>;
export type ToggleSetCompletionDto = z.infer<typeof toggleSetCompletionSchema>;
export type BatchCreateSetsDto = z.infer<typeof batchCreateSetsSchema>;

function validateSetPayload(payload: unknown): string | undefined {
  if (!isJsonObject(payload)) {
    return 'payload must be a JSON object';
  }

  const seenObjects = new WeakSet<object>();
  const stack: Array<{ value: unknown; depth: number }> = [
    { value: payload, depth: 1 },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (current.depth > MAX_SET_PAYLOAD_DEPTH) {
      return `payload nesting must not exceed ${MAX_SET_PAYLOAD_DEPTH} levels`;
    }

    const { value } = current;
    if (value === null) {
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      continue;
    }

    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        continue;
      }

      return 'payload numbers must be finite';
    }

    if (Array.isArray(value)) {
      if (value.length > MAX_SET_PAYLOAD_ARRAY_LENGTH) {
        return `payload arrays must not exceed ${MAX_SET_PAYLOAD_ARRAY_LENGTH} items`;
      }

      for (const item of value) {
        stack.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }

    if (isJsonObject(value)) {
      if (seenObjects.has(value)) {
        return 'payload must not contain circular references';
      }
      seenObjects.add(value);

      for (const nestedValue of Object.values(value)) {
        stack.push({ value: nestedValue, depth: current.depth + 1 });
      }
      continue;
    }

    return 'payload must contain only JSON-safe values';
  }

  try {
    if (JSON.stringify(payload).length > MAX_SET_PAYLOAD_SERIALIZED_LENGTH) {
      return `payload must serialize to at most ${MAX_SET_PAYLOAD_SERIALIZED_LENGTH} characters`;
    }
  } catch {
    return 'payload must not contain circular references';
  }

  return undefined;
}

function isJsonObject(
  value: unknown,
): value is Record<string, JsonValue | unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
