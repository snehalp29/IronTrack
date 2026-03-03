import {
  createWorkoutTemplateSchema,
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
});
