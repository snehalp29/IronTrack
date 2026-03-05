import { z } from 'zod';

const optionalQueryBooleanSchema = z
  .preprocess((value) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return value;
  }, z.boolean())
  .optional();

export const listExercisesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  muscleGroup: z.string().optional(),
  equipment: z.string().optional(),
  type: z
    .enum([
      'WEIGHT_REPS',
      'BODYWEIGHT',
      'DURATION',
      'REPS_ONLY',
      'BODYWEIGHT_PLUS_WEIGHT',
    ])
    .optional(),
  search: z.string().optional(),
  isGlobal: optionalQueryBooleanSchema,
});

const exerciseTypeSchema = z.enum([
  'WEIGHT_REPS',
  'BODYWEIGHT',
  'DURATION',
  'REPS_ONLY',
  'BODYWEIGHT_PLUS_WEIGHT',
]);

function validateRepRange(
  data: { repMin?: number; repMax?: number },
  ctx: z.RefinementCtx,
): void {
  if (
    typeof data.repMin === 'number' &&
    typeof data.repMax === 'number' &&
    data.repMin > data.repMax
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['repMax'],
      message: 'repMax must be greater than or equal to repMin',
    });
  }
}

export const createExerciseSchema = z
  .object({
    name: z.string().min(2).max(120),
    description: z.string().max(4000).optional(),
    exerciseType: exerciseTypeSchema,
    primaryMuscleGroupId: z.string().uuid(),
    secondaryMuscleGroupIds: z.array(z.string().uuid()).default([]),
    equipmentIds: z.array(z.string().uuid()).default([]),
    defaultSets: z.number().int().positive().optional(),
    repMin: z.number().int().positive().optional(),
    repMax: z.number().int().positive().optional(),
    defaultCues: z.string().max(4000).optional(),
  })
  .superRefine(validateRepRange);

export const updateExerciseSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(4000).optional(),
    exerciseType: exerciseTypeSchema.optional(),
    primaryMuscleGroupId: z.string().uuid().optional(),
    secondaryMuscleGroupIds: z.array(z.string().uuid()).optional(),
    equipmentIds: z.array(z.string().uuid()).optional(),
    defaultSets: z.number().int().positive().optional(),
    repMin: z.number().int().positive().optional(),
    repMax: z.number().int().positive().optional(),
    defaultCues: z.string().max(4000).optional(),
  })
  .superRefine(validateRepRange);

export const upsertExerciseNoteSchema = z.object({
  note: z.string().min(1).max(4000),
});

export const exerciseHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;
export type CreateExerciseDto = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseDto = z.infer<typeof updateExerciseSchema>;
export type UpsertExerciseNoteDto = z.infer<typeof upsertExerciseNoteSchema>;
export type ExerciseHistoryQueryDto = z.infer<
  typeof exerciseHistoryQuerySchema
>;
