import {
  createWorkoutTemplateSchema,
  listWorkoutTemplatesQuerySchema,
  reorderWorkoutTemplateSchema,
  updateWorkoutTemplateSchema,
} from './workout-template.schemas';

describe('workout-template schemas', () => {
  it('validates create and update template payloads', () => {
    expect(
      createWorkoutTemplateSchema.parse({
        name: 'Pull Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
        ],
      }),
    ).toEqual({
      name: 'Pull Day',
      exercises: [
        {
          exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
          orderIndex: 0,
        },
      ],
    });

    expect(updateWorkoutTemplateSchema.parse({ name: 'Updated Name' })).toEqual(
      {
        name: 'Updated Name',
      },
    );
  });

  it('validates template list query payloads', () => {
    expect(
      listWorkoutTemplatesQuerySchema.parse({
        page: '2',
        pageSize: '25',
      }),
    ).toEqual({
      page: 2,
      pageSize: 25,
    });
  });

  it('rejects invalid rep ranges where repMin is greater than repMax', () => {
    expect(() =>
      createWorkoutTemplateSchema.parse({
        name: 'Upper Body',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            repMin: 12,
            repMax: 8,
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      updateWorkoutTemplateSchema.parse({
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            repMin: 10,
            repMax: 5,
          },
        ],
      }),
    ).toThrow();
  });

  it('normalizes empty or whitespace superset group keys to undefined', () => {
    expect(
      createWorkoutTemplateSchema.parse({
        name: 'Push Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            supersetGroupKey: '',
          },
        ],
      }).exercises[0]?.supersetGroupKey,
    ).toBeUndefined();

    expect(
      createWorkoutTemplateSchema.parse({
        name: 'Push Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            supersetGroupKey: '   ',
          },
        ],
      }).exercises[0]?.supersetGroupKey,
    ).toBeUndefined();

    expect(
      updateWorkoutTemplateSchema.parse({
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            supersetGroupKey: '',
          },
        ],
      }).exercises?.[0]?.supersetGroupKey,
    ).toBeUndefined();

    expect(
      updateWorkoutTemplateSchema.parse({
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            supersetGroupKey: '\n\t ',
          },
        ],
      }).exercises?.[0]?.supersetGroupKey,
    ).toBeUndefined();
  });

  it('trims superset group key values', () => {
    expect(
      createWorkoutTemplateSchema.parse({
        name: 'Push Day',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            supersetGroupKey: ' A ',
          },
        ],
      }).exercises[0]?.supersetGroupKey,
    ).toBe('A');

    expect(
      updateWorkoutTemplateSchema.parse({
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
            supersetGroupKey: '  group-1  ',
          },
        ],
      }).exercises?.[0]?.supersetGroupKey,
    ).toBe('group-1');
  });

  it('validates reorder payload', () => {
    expect(
      reorderWorkoutTemplateSchema.parse({
        items: [{ id: '11111111-1111-4111-8111-111111111111', orderIndex: 2 }],
      }),
    ).toEqual({
      items: [{ id: '11111111-1111-4111-8111-111111111111', orderIndex: 2 }],
    });

    expect(() => reorderWorkoutTemplateSchema.parse({ items: [] })).toThrow();
  });

  it('rejects create payloads with more than 200 exercises', () => {
    expect(() =>
      createWorkoutTemplateSchema.parse({
        name: 'Large Template',
        exercises: Array.from({ length: 201 }, (_, index) => ({
          exerciseTemplateId: `11111111-1111-4111-8111-${String(index)
            .padStart(12, '0')
            .slice(-12)}`,
          orderIndex: index,
        })),
      }),
    ).toThrow();
  });

  it('rejects update payloads with more than 200 exercises', () => {
    expect(() =>
      updateWorkoutTemplateSchema.parse({
        exercises: Array.from({ length: 201 }, (_, index) => ({
          exerciseTemplateId: `11111111-1111-4111-8111-${String(index)
            .padStart(12, '0')
            .slice(-12)}`,
          orderIndex: index,
        })),
      }),
    ).toThrow();
  });

  it('rejects empty exercises arrays on update', () => {
    expect(() =>
      updateWorkoutTemplateSchema.parse({
        exercises: [],
      }),
    ).toThrow();
  });

  it('rejects reorder payloads with duplicate template ids or order indexes', () => {
    expect(() =>
      reorderWorkoutTemplateSchema.parse({
        items: [
          { id: '11111111-1111-4111-8111-111111111111', orderIndex: 0 },
          { id: '11111111-1111-4111-8111-111111111111', orderIndex: 1 },
        ],
      }),
    ).toThrow();

    expect(() =>
      reorderWorkoutTemplateSchema.parse({
        items: [
          { id: '11111111-1111-4111-8111-111111111111', orderIndex: 2 },
          { id: '22222222-2222-4222-8222-222222222222', orderIndex: 2 },
        ],
      }),
    ).toThrow();
  });

  it('rejects duplicate exercise order indexes in create and update payloads', () => {
    expect(() =>
      createWorkoutTemplateSchema.parse({
        name: 'Upper Body',
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 0,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 0,
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      updateWorkoutTemplateSchema.parse({
        exercises: [
          {
            exerciseTemplateId: '11111111-1111-4111-8111-111111111111',
            orderIndex: 1,
          },
          {
            exerciseTemplateId: '22222222-2222-4222-8222-222222222222',
            orderIndex: 1,
          },
        ],
      }),
    ).toThrow();
  });
});
