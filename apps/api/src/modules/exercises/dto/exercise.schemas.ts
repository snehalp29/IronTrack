import { z } from 'zod';

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
  isGlobal: z.coerce.boolean().optional(),
});

export const createExerciseSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  exerciseType: z.enum([
    'WEIGHT_REPS',
    'BODYWEIGHT',
    'DURATION',
    'REPS_ONLY',
    'BODYWEIGHT_PLUS_WEIGHT',
  ]),
  primaryMuscleGroupId: z.string().uuid(),
  secondaryMuscleGroupIds: z.array(z.string().uuid()).default([]),
  equipmentIds: z.array(z.string().uuid()).default([]),
  defaultSets: z.number().int().positive().optional(),
  repMin: z.number().int().positive().optional(),
  repMax: z.number().int().positive().optional(),
  defaultCues: z.string().max(4000).optional(),
});

const createExerciseSchemaWithoutRelationDefaults = createExerciseSchema.extend(
  {
    secondaryMuscleGroupIds: z.array(z.string().uuid()),
    equipmentIds: z.array(z.string().uuid()),
  },
);

export const updateExerciseSchema =
  createExerciseSchemaWithoutRelationDefaults.partial();

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
