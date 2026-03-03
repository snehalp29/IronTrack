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
