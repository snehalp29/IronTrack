import { z } from 'zod';

import { optionalTrimmed } from '../../../common/validation/optional-trimmed';

const MAX_TEMPLATE_EXERCISES = 200;

const optionalSupersetGroupKeySchema = optionalTrimmed(z.string());

const templateExerciseSchema = z
  .object({
    exerciseTemplateId: z.string().uuid(),
    orderIndex: z.number().int().nonnegative(),
    defaultSets: z.number().int().positive().optional(),
    repMin: z.number().int().positive().optional(),
    repMax: z.number().int().positive().optional(),
    supersetGroupKey: optionalSupersetGroupKeySchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.repMin !== undefined &&
      value.repMax !== undefined &&
      value.repMin > value.repMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['repMin'],
        message: 'repMin must be less than or equal to repMax',
      });
    }
  });

export const createWorkoutTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  exercises: z.array(templateExerciseSchema).min(1).max(MAX_TEMPLATE_EXERCISES),
});

export const updateWorkoutTemplateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(4000).optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  exercises: z
    .array(templateExerciseSchema)
    .max(MAX_TEMPLATE_EXERCISES)
    .optional(),
});

export const reorderWorkoutTemplateSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .superRefine((items, ctx) => {
      const seenIds = new Set<string>();
      const seenOrderIndexes = new Set<number>();

      for (const [index, item] of items.entries()) {
        if (seenIds.has(item.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'id'],
            message: 'Duplicate template id in reorder payload',
          });
        }
        seenIds.add(item.id);

        if (seenOrderIndexes.has(item.orderIndex)) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'orderIndex'],
            message: 'Duplicate orderIndex in reorder payload',
          });
        }
        seenOrderIndexes.add(item.orderIndex);
      }
    }),
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
