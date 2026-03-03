import { createSetSchema, updateSetSchema } from './session.schemas';

describe('session set schemas', () => {
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
});
