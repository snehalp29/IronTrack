import { z } from 'zod';

const templateExerciseSchema = z.object({
  exerciseTemplateId: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  defaultSets: z.number().int().positive().optional(),
  repMin: z.number().int().positive().optional(),
  repMax: z.number().int().positive().optional(),
  supersetGroupKey: z.string().optional(),
});

export const createWorkoutTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  exercises: z.array(templateExerciseSchema).min(1),
});

export const updateWorkoutTemplateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(4000).optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  exercises: z.array(templateExerciseSchema).optional(),
});

export const reorderWorkoutTemplateSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export type CreateWorkoutTemplateDto = z.infer<
  typeof createWorkoutTemplateSchema
>;
export type UpdateWorkoutTemplateDto = z.infer<
  typeof updateWorkoutTemplateSchema
>;
export type ReorderWorkoutTemplateDto = z.infer<
  typeof reorderWorkoutTemplateSchema
>;
