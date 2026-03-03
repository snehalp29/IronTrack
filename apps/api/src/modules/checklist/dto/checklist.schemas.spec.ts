import {
  checklistQuerySchema,
  checklistWeekQuerySchema,
  upsertChecklistSchema,
} from './checklist.schemas';

describe('checklist schemas', () => {
  it('parses valid checklist query and week query', () => {
    expect(checklistQuerySchema.parse({ date: '2024-01-01' })).toEqual({
      date: '2024-01-01',
    });
    expect(checklistWeekQuerySchema.parse({ startDate: '2024-01-01' })).toEqual(
      {
        startDate: '2024-01-01',
      },
    );
  });

  it('validates upsert checklist payload', () => {
    expect(
      upsertChecklistSchema.parse({
        date: '2024-01-01',
        type: 'WORKOUT',
        isCompleted: true,
      }),
    ).toEqual({
      date: '2024-01-01',
      type: 'WORKOUT',
      isCompleted: true,
    });

    expect(() =>
      upsertChecklistSchema.parse({
        date: '2024/01/01',
        type: 'WORKOUT',
        isCompleted: true,
      }),
    ).toThrow();
  });

  it('rejects impossible calendar dates', () => {
    expect(() => checklistQuerySchema.parse({ date: '2024-99-99' })).toThrow();
    expect(() =>
      checklistWeekQuerySchema.parse({ startDate: '2024-02-30' }),
    ).toThrow();
    expect(() =>
      upsertChecklistSchema.parse({
        date: '2024-04-31',
        type: 'WORKOUT',
        isCompleted: true,
      }),
    ).toThrow();
  });
});
