import {
  addSessionExerciseSchema,
  createSetSchema,
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

  it('normalizes empty superset group keys to undefined', () => {
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
      addSessionExerciseSchema.parse({
        exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
        orderIndex: 0,
        supersetGroupKey: '',
      }).supersetGroupKey,
    ).toBeUndefined();

    expect(
      updateSessionExerciseSchema.parse({
        supersetGroupKey: '',
      }).supersetGroupKey,
    ).toBeUndefined();
  });
});
