import {
  createExerciseSchema,
  exerciseHistoryQuerySchema,
  listExercisesQuerySchema,
  updateExerciseSchema,
  upsertExerciseNoteSchema,
} from './exercise.schemas';

describe('exercise schemas', () => {
  it('applies defaults in list query schema', () => {
    expect(listExercisesQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it('validates exercise create payload and keeps omitted update relations undefined', () => {
    const payload = {
      name: 'Back Squat',
      exerciseType: 'WEIGHT_REPS',
      primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
    };

    expect(createExerciseSchema.parse(payload)).toEqual({
      ...payload,
      secondaryMuscleGroupIds: [],
      equipmentIds: [],
    });
    expect(updateExerciseSchema.parse({ name: 'Updated Squat' })).toEqual({
      name: 'Updated Squat',
    });
  });

  it('allows explicit relation clearing on update when empty arrays are provided', () => {
    expect(
      updateExerciseSchema.parse({
        secondaryMuscleGroupIds: [],
        equipmentIds: [],
      }),
    ).toEqual({
      secondaryMuscleGroupIds: [],
      equipmentIds: [],
    });
  });

  it('rejects rep ranges where repMin is greater than repMax', () => {
    const invalidCreate = createExerciseSchema.safeParse({
      name: 'Back Squat',
      exerciseType: 'WEIGHT_REPS',
      primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
      repMin: 12,
      repMax: 8,
    });

    expect(invalidCreate.success).toBe(false);
    if (!invalidCreate.success) {
      expect(invalidCreate.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['repMax'],
            message: 'repMax must be greater than or equal to repMin',
          }),
        ]),
      );
    }

    const invalidUpdate = updateExerciseSchema.safeParse({
      repMin: 10,
      repMax: 5,
    });

    expect(invalidUpdate.success).toBe(false);
    if (!invalidUpdate.success) {
      expect(invalidUpdate.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['repMax'],
            message: 'repMax must be greater than or equal to repMin',
          }),
        ]),
      );
    }
  });

  it('accepts rep ranges where repMin is less than or equal to repMax', () => {
    expect(
      createExerciseSchema.parse({
        name: 'Back Squat',
        exerciseType: 'WEIGHT_REPS',
        primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
        repMin: 8,
        repMax: 12,
      }),
    ).toEqual({
      name: 'Back Squat',
      exerciseType: 'WEIGHT_REPS',
      primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
      secondaryMuscleGroupIds: [],
      equipmentIds: [],
      repMin: 8,
      repMax: 12,
    });

    expect(
      updateExerciseSchema.parse({
        repMin: 10,
        repMax: 10,
      }),
    ).toEqual({
      repMin: 10,
      repMax: 10,
    });
  });

  it('validates note and history query payloads', () => {
    expect(upsertExerciseNoteSchema.parse({ note: 'Keep elbows in' })).toEqual({
      note: 'Keep elbows in',
    });
    expect(exerciseHistoryQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });

    expect(() => listExercisesQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => upsertExerciseNoteSchema.parse({ note: '' })).toThrow();
  });
});
