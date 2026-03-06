import {
  addSessionExerciseSchema,
  batchCreateSetsSchema,
  createSetSchema,
  listSessionsQuerySchema,
  reorderSessionExercisesSchema,
  startSessionSchema,
  updateSessionExerciseSchema,
  updateSetSchema,
} from './session.schemas';

describe('session set schemas', () => {
  it('allows inline exercises without orderIndex for append-style session creation', () => {
    const result = startSessionSchema.safeParse({
      notes: 'quick workout',
      exercises: [
        {
          exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects negative numeric set values on create', () => {
    const result = createSetSchema.safeParse({
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {},
      weight: -5,
      reps: -1,
      durationSeconds: -10,
      rpe: -0.5,
    });

    expect(result.success).toBe(false);
  });

  it('rejects out-of-range RPE on create', () => {
    const result = createSetSchema.safeParse({
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {},
      rpe: 11,
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid numeric updates', () => {
    const result = updateSetSchema.safeParse({
      weight: -1,
      reps: 0,
      durationSeconds: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects completedAt when isCompleted is false', () => {
    const result = createSetSchema.safeParse({
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {},
      isCompleted: false,
      completedAt: '2026-03-03T12:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('rejects completedAt when isCompleted is omitted on create', () => {
    const result = createSetSchema.safeParse({
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {},
      completedAt: '2026-03-03T12:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('rejects completedAt when isCompleted is omitted on update', () => {
    const result = updateSetSchema.safeParse({
      completedAt: '2026-03-03T12:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('accepts completedAt only when isCompleted is true', () => {
    const result = updateSetSchema.safeParse({
      isCompleted: true,
      completedAt: '2026-03-03T12:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects oversized set payloads', () => {
    const result = createSetSchema.safeParse({
      orderIndex: 0,
      type: 'WEIGHT_REPS',
      payload: {
        notes: 'x'.repeat(5000),
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects reorder payloads with no items', () => {
    const result = reorderSessionExercisesSchema.safeParse({
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects reorder payloads with duplicate exercise ids', () => {
    const result = reorderSessionExercisesSchema.safeParse({
      items: [
        { id: '11111111-1111-4111-8111-111111111111', orderIndex: 0 },
        { id: '11111111-1111-4111-8111-111111111111', orderIndex: 1 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects reorder payloads with duplicate order indexes', () => {
    const result = reorderSessionExercisesSchema.safeParse({
      items: [
        { id: '11111111-1111-4111-8111-111111111111', orderIndex: 0 },
        { id: '22222222-2222-4222-8222-222222222222', orderIndex: 0 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('normalizes empty or whitespace superset group keys to undefined', () => {
    expect(
      startSessionSchema.parse({
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            supersetGroupKey: '',
          },
        ],
      }).exercises[0]?.supersetGroupKey,
    ).toBeUndefined();

    expect(
      startSessionSchema.parse({
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            supersetGroupKey: '   ',
          },
        ],
      }).exercises[0]?.supersetGroupKey,
    ).toBeUndefined();

    expect(
      addSessionExerciseSchema.parse({
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
        supersetGroupKey: '',
      }).supersetGroupKey,
    ).toBeUndefined();

    expect(
      addSessionExerciseSchema.parse({
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
        supersetGroupKey: '\n\t ',
      }).supersetGroupKey,
    ).toBeUndefined();

    expect(
      updateSessionExerciseSchema.parse({
        supersetGroupKey: '',
      }).supersetGroupKey,
    ).toBeUndefined();

    expect(
      updateSessionExerciseSchema.parse({
        supersetGroupKey: 'A',
      }).supersetGroupKey,
    ).toBe('A');

    expect(
      updateSessionExerciseSchema.parse({
        supersetGroupKey: ' group-1 ',
      }).supersetGroupKey,
    ).toBe('group-1');

    expect(
      updateSessionExerciseSchema.parse({
        supersetGroupKey: null,
      }).supersetGroupKey,
    ).toBeNull();
  });

  it('rejects startSession payloads with more than 200 inline exercises', () => {
    const result = startSessionSchema.safeParse({
      exercises: Array.from({ length: 201 }, (_, index) => ({
        exerciseTemplateId: `11111111-1111-4111-8111-${String(index)
          .padStart(12, '0')
          .slice(-12)}`,
        orderIndex: index,
      })),
    });

    expect(result.success).toBe(false);
  });

  it('rejects batch set payloads with more than 100 sets', () => {
    const result = batchCreateSetsSchema.safeParse({
      sets: Array.from({ length: 101 }, (_, index) => ({
        orderIndex: index,
        type: 'WEIGHT_REPS' as const,
        payload: {},
      })),
    });

    expect(result.success).toBe(false);
  });

  it('rejects session list queries that span more than 366 days', () => {
    const result = listSessionsQuerySchema.safeParse({
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2025-01-02T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });
});
