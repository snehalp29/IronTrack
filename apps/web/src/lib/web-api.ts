import { z } from 'zod';

import { apiFetch } from '../api/client';

const isoDateTimeSchema = z.string().min(1);
const optionalStringSchema = z.string().nullable().optional();
const optionalNumberSchema = z.number().nullable().optional();

const workoutSetSchema = z.object({
  id: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  reps: optionalNumberSchema,
  weight: optionalNumberSchema,
  durationSeconds: optionalNumberSchema,
  isCompleted: z.boolean(),
});

const sessionExerciseSchema = z.object({
  id: z.string().min(1),
  exerciseTemplateId: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  supersetGroupKey: optionalStringSchema,
  notes: optionalStringSchema,
  exercise: z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
  }),
  sets: z.array(workoutSetSchema).default([]),
});

const workoutSessionSchema = z.object({
  id: z.string().min(1),
  workoutTemplateId: optionalStringSchema,
  startedAt: isoDateTimeSchema,
  durationSeconds: optionalNumberSchema,
  totalVolume: optionalNumberSchema,
  status: z.string().min(1).optional(),
  sessionExercises: z.array(sessionExerciseSchema).default([]),
});

const listSessionsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      startedAt: isoDateTimeSchema,
      durationSeconds: optionalNumberSchema,
      totalVolume: optionalNumberSchema,
      status: z.enum(['IN_PROGRESS', 'FINISHED']).optional(),
      workoutTemplate: z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
        })
        .nullable()
        .optional(),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
});

const workoutTemplateExerciseSchema = z.object({
  id: z.string().min(1).optional(),
  orderIndex: z.number().int().nonnegative(),
  defaultSets: optionalNumberSchema,
  repMin: optionalNumberSchema,
  repMax: optionalNumberSchema,
  exercise: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
});

const workoutTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: optionalStringSchema,
  exercises: z.array(workoutTemplateExerciseSchema).default([]),
  muscleCoverage: z.array(z.string()).optional(),
});

const workoutTemplateListSchema = z.array(workoutTemplateSchema);

const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().nullable().optional(),
  timezone: z.string().min(1),
  unitPreference: z.enum(['METRIC', 'IMPERIAL']),
  avatarUrl: optionalStringSchema,
});

const checklistItemSchema = z.object({
  id: z.string().min(1),
  date: isoDateTimeSchema,
  type: z.enum(['WORKOUT', 'WARMUP', 'MOBILITY', 'NOTES']),
  isCompleted: z.boolean(),
  completedAt: optionalStringSchema,
});

const checklistItemsSchema = z.array(checklistItemSchema);

const progressVolumeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  volume: z.number(),
});

const weeklyProgressSchema = z.object({
  weekStart: isoDateTimeSchema,
  weekEnd: isoDateTimeSchema,
  coveragePercent: z.number(),
  coveredMuscles: z.number().int().nonnegative(),
  totalMuscles: z.number().int().nonnegative(),
  perMuscleVolume: z.array(progressVolumeSchema),
});

const workoutStreakSchema = z.object({
  currentStreakDays: z.number().int().nonnegative(),
  longestStreakDays: z.number().int().nonnegative(),
  lastCompletedDate: z.string().nullable(),
});

const exerciseListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      exerciseType: z.string().min(1),
      description: optionalStringSchema,
      primaryMuscle: z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
        })
        .nullable()
        .optional(),
    }),
  ),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
});

const catalogItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const exerciseDetailSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: optionalStringSchema,
  exerciseType: z.string().min(1),
  primaryMuscle: catalogItemSchema.nullable().optional(),
  secondaryMuscles: z
    .array(
      z.object({
        muscleGroup: catalogItemSchema,
      }),
    )
    .default([]),
  equipment: z
    .array(
      z.object({
        equipment: catalogItemSchema,
      }),
    )
    .default([]),
  defaultSets: optionalNumberSchema,
  repMin: optionalNumberSchema,
  repMax: optionalNumberSchema,
  defaultCues: optionalStringSchema,
  notes: z
    .array(
      z.object({
        note: z.string().min(1),
      }),
    )
    .default([]),
});

const exerciseHistorySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        reps: optionalNumberSchema,
        weight: optionalNumberSchema,
        durationSeconds: optionalNumberSchema,
        sessionExercise: z.object({
          session: z.object({
            id: z.string().min(1),
            startedAt: isoDateTimeSchema,
            finishedAt: optionalStringSchema,
          }),
        }),
      }),
    )
    .default([]),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
});

const catalogListSchema = z.array(catalogItemSchema);

const finishSessionSchema = workoutSessionSchema.extend({
  totalVolume: z.number(),
  newPrs: z.array(z.unknown()),
  completion: z.object({
    completedSets: z.number().int().nonnegative(),
    totalSets: z.number().int().nonnegative(),
    isIncomplete: z.boolean(),
  }),
  warning: z.string().nullable(),
});

const successResponseSchema = z.object({
  success: z.boolean(),
});

export type ActiveSessionPayload = z.infer<typeof workoutSessionSchema>;
export type FinishSessionPayload = z.infer<typeof finishSessionSchema>;
export type WorkoutTemplatePayload = z.infer<typeof workoutTemplateSchema>;
export type ListSessionsPayload = z.infer<typeof listSessionsResponseSchema>;
export type ExerciseListPayload = z.infer<typeof exerciseListSchema>;
export type ExerciseDetailPayload = z.infer<typeof exerciseDetailSchema>;
export type ExerciseHistoryPayload = z.infer<typeof exerciseHistorySchema>;
export type CatalogItemPayload = z.infer<typeof catalogItemSchema>;
export type WeeklyProgressPayload = z.infer<typeof weeklyProgressSchema>;
export type WorkoutStreakPayload = z.infer<typeof workoutStreakSchema>;

export async function fetchCurrentUser() {
  return requirePayload(
    apiFetch('/users/me', {
      schema: userSchema,
    }),
  );
}

export async function updateCurrentUser(input: {
  name?: string;
  timezone: string;
  unitPreference: 'METRIC' | 'IMPERIAL';
}) {
  return requirePayload(
    apiFetch('/users/me', {
      method: 'PATCH',
      body: input as unknown as BodyInit,
      schema: userSchema,
    }),
  );
}

export async function deleteCurrentUser() {
  return requirePayload(
    apiFetch('/users/me', {
      method: 'DELETE',
      schema: successResponseSchema,
    }),
  );
}

export async function fetchChecklistForDate(date: string) {
  return requirePayload(
    apiFetch(`/checklist?date=${encodeURIComponent(date)}`, {
      schema: checklistItemsSchema,
    }),
  );
}

export async function fetchWeeklyProgress(startDate?: string) {
  const suffix = startDate ? `?startDate=${encodeURIComponent(startDate)}` : '';
  return requirePayload(
    apiFetch(`/progress/weekly${suffix}`, {
      schema: weeklyProgressSchema,
    }),
  );
}

export async function fetchWorkoutStreak() {
  return requirePayload(
    apiFetch('/streaks/workout', {
      schema: workoutStreakSchema,
    }),
  );
}

export async function fetchWorkoutTemplates() {
  return requirePayload(
    apiFetch('/workout-templates', {
      schema: workoutTemplateListSchema,
    }),
  );
}

export async function fetchWorkoutTemplateById(templateId: string) {
  return requirePayload(
    apiFetch(`/workout-templates/${templateId}`, {
      schema: workoutTemplateSchema,
    }),
  );
}

export async function createWorkoutTemplate(input: {
  name: string;
  description?: string;
  exercises: Array<{
    exerciseTemplateId: string;
    orderIndex: number;
    defaultSets?: number;
    repMin?: number;
    repMax?: number;
    supersetGroupKey?: string;
  }>;
}) {
  return requirePayload(
    apiFetch('/workout-templates', {
      method: 'POST',
      body: input as unknown as BodyInit,
      schema: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
      }),
    }),
  );
}

export async function fetchActiveSession() {
  return apiFetch('/sessions/active', {
    schema: workoutSessionSchema.nullable(),
  });
}

export async function startWorkoutSession(input: {
  workoutTemplateId?: string;
  exercises?: Array<{
    exerciseTemplateId: string;
    orderIndex?: number;
    notes?: string;
    supersetGroupKey?: string;
  }>;
}) {
  return requirePayload(
    apiFetch('/sessions', {
      method: 'POST',
      body: input as unknown as BodyInit,
      schema: workoutSessionSchema,
    }),
  );
}

export async function finishWorkoutSession(sessionId: string) {
  return requirePayload(
    apiFetch(`/sessions/${sessionId}/finish`, {
      method: 'POST',
      schema: finishSessionSchema,
    }),
  );
}

export async function listWorkoutSessions(input?: {
  page?: number;
  pageSize?: number;
  status?: 'IN_PROGRESS' | 'FINISHED';
}) {
  const searchParams = new URLSearchParams();
  if (input?.page) {
    searchParams.set('page', String(input.page));
  }
  if (input?.pageSize) {
    searchParams.set('pageSize', String(input.pageSize));
  }
  if (input?.status) {
    searchParams.set('status', input.status);
  }

  const query = searchParams.toString();
  return requirePayload(
    apiFetch(`/sessions${query ? `?${query}` : ''}`, {
      schema: listSessionsResponseSchema,
    }),
  );
}

export async function toggleWorkoutSetCompletion(
  sessionExerciseId: string,
  setId: string,
  isCompleted: boolean,
) {
  return requirePayload(
    apiFetch(`/session-exercises/${sessionExerciseId}/sets/${setId}/complete`, {
      method: 'PATCH',
      body: { isCompleted } as unknown as BodyInit,
      schema: workoutSetSchema,
    }),
  );
}

export async function deleteWorkoutExercise(
  sessionId: string,
  sessionExerciseId: string,
) {
  return requirePayload(
    apiFetch(`/sessions/${sessionId}/exercises/${sessionExerciseId}`, {
      method: 'DELETE',
      schema: successResponseSchema,
    }),
  );
}

export async function updateWorkoutExercise(
  sessionId: string,
  sessionExerciseId: string,
  input: {
    notes?: string;
    supersetGroupKey?: string | null;
  },
) {
  return requirePayload(
    apiFetch(`/sessions/${sessionId}/exercises/${sessionExerciseId}`, {
      method: 'PATCH',
      body: input as unknown as BodyInit,
      schema: sessionExerciseSchema,
    }),
  );
}

export async function reorderWorkoutExercises(
  sessionId: string,
  items: Array<{ id: string; orderIndex: number }>,
) {
  return requirePayload(
    apiFetch(`/sessions/${sessionId}/exercises/reorder`, {
      method: 'PATCH',
      body: { items } as unknown as BodyInit,
      schema: successResponseSchema,
    }),
  );
}

export async function swapWorkoutExercise(
  sessionId: string,
  fromExerciseId: string,
  toExerciseTemplateId: string,
) {
  return requirePayload(
    apiFetch(`/sessions/${sessionId}/exercises/swap`, {
      method: 'POST',
      body: {
        fromExerciseId,
        toExerciseTemplateId,
      } as unknown as BodyInit,
      schema: sessionExerciseSchema,
    }),
  );
}

export async function applyWorkoutSuperset(
  sessionId: string,
  exerciseIds: string[],
) {
  return requirePayload(
    apiFetch(`/sessions/${sessionId}/exercises/superset`, {
      method: 'PATCH',
      body: { exerciseIds } as unknown as BodyInit,
      schema: workoutSessionSchema,
    }),
  );
}

export async function listExercises() {
  const firstPage = await fetchExerciseListPage(1, 100);
  const totalPages = Math.ceil(
    firstPage.pagination.total / firstPage.pagination.pageSize,
  );

  if (totalPages <= 1) {
    return firstPage;
  }

  const items = [...firstPage.items];
  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchExerciseListPage(page, 100);
    items.push(...nextPage.items);
  }

  return {
    ...firstPage,
    items,
    pagination: {
      ...firstPage.pagination,
      total: firstPage.pagination.total,
    },
  };
}

export async function createExercise(input: {
  name: string;
  description?: string;
  exerciseType: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupIds: string[];
  equipmentIds: string[];
  defaultSets?: number;
  repMin?: number;
  repMax?: number;
  defaultCues?: string;
}) {
  return requirePayload(
    apiFetch('/exercises', {
      method: 'POST',
      body: input as unknown as BodyInit,
      schema: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
      }),
    }),
  );
}

export async function fetchExerciseById(exerciseId: string) {
  return requirePayload(
    apiFetch(`/exercises/${exerciseId}`, {
      schema: exerciseDetailSchema,
    }),
  );
}

export async function fetchExerciseHistory(
  exerciseId: string,
  input?: {
    page?: number;
    pageSize?: number;
  },
) {
  const searchParams = new URLSearchParams();
  if (input?.page) {
    searchParams.set('page', String(input.page));
  }
  if (input?.pageSize) {
    searchParams.set('pageSize', String(input.pageSize));
  }

  const query = searchParams.toString();
  return requirePayload(
    apiFetch(`/exercises/${exerciseId}/history${query ? `?${query}` : ''}`, {
      schema: exerciseHistorySchema,
    }),
  );
}

export async function fetchMuscleGroups() {
  return requirePayload(
    apiFetch('/muscle-groups', {
      schema: catalogListSchema,
    }),
  );
}

export async function fetchEquipment() {
  return requirePayload(
    apiFetch('/equipment', {
      schema: catalogListSchema,
    }),
  );
}

async function requirePayload<T>(promise: Promise<T | undefined>): Promise<T> {
  const payload = await promise;
  if (payload === undefined) {
    throw new Error('API response shape was invalid');
  }

  return payload;
}

async function fetchExerciseListPage(page: number, pageSize: number) {
  return requirePayload(
    apiFetch(`/exercises?page=${page}&pageSize=${pageSize}`, {
      schema: exerciseListSchema,
    }),
  );
}
