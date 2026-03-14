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

  it('trims list query filters and treats blank strings as missing', () => {
    expect(
      listExercisesQuerySchema.parse({
        muscleGroup: '  Chest  ',
        equipment: '  Barbell  ',
        search: '  bench press  ',
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      search: 'bench press',
    });

    expect(
      listExercisesQuerySchema.parse({
        muscleGroup: '   ',
        equipment: '\n\t',
        search: '',
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      muscleGroup: undefined,
      equipment: undefined,
      search: undefined,
    });
  });

  it('rejects overly long list query filters and search strings', () => {
    expect(() =>
      listExercisesQuerySchema.parse({
        muscleGroup: 'm'.repeat(121),
      }),
    ).toThrow();
    expect(() =>
      listExercisesQuerySchema.parse({
        equipment: 'e'.repeat(121),
      }),
    ).toThrow();
    expect(() =>
      listExercisesQuerySchema.parse({
        search: 's'.repeat(201),
      }),
    ).toThrow();
  });

  it('parses boolean query strings for isGlobal explicitly', () => {
    expect(listExercisesQuerySchema.parse({ isGlobal: 'false' }).isGlobal).toBe(
      false,
    );
    expect(listExercisesQuerySchema.parse({ isGlobal: 'true' }).isGlobal).toBe(
      true,
    );
    expect(
      listExercisesQuerySchema.parse({ isGlobal: '  FALSE  ' }).isGlobal,
    ).toBe(false);

    expect(() =>
      listExercisesQuerySchema.parse({ isGlobal: 'not-a-boolean' }),
    ).toThrow();
  });

  it('accepts boolean values for isGlobal without string coercion', () => {
    expect(listExercisesQuerySchema.parse({ isGlobal: true }).isGlobal).toBe(
      true,
    );
    expect(listExercisesQuerySchema.parse({ isGlobal: false }).isGlobal).toBe(
      false,
    );
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

  it('rejects overly large secondary muscle and equipment relation arrays', () => {
    const tooManyIds = Array.from(
      { length: 21 },
      (_, index) =>
        `11111111-1111-4111-8111-${String(index).padStart(12, '0').slice(-12)}`,
    );

    expect(() =>
      createExerciseSchema.parse({
        name: 'Back Squat',
        exerciseType: 'WEIGHT_REPS',
        primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
        secondaryMuscleGroupIds: tooManyIds,
      }),
    ).toThrow();
    expect(() =>
      createExerciseSchema.parse({
        name: 'Back Squat',
        exerciseType: 'WEIGHT_REPS',
        primaryMuscleGroupId: '11111111-1111-4111-8111-111111111111',
        equipmentIds: tooManyIds,
      }),
    ).toThrow();
    expect(() =>
      updateExerciseSchema.parse({
        secondaryMuscleGroupIds: tooManyIds,
      }),
    ).toThrow();
    expect(() =>
      updateExerciseSchema.parse({
        equipmentIds: tooManyIds,
      }),
    ).toThrow();
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
