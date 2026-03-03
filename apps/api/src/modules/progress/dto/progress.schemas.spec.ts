import { weeklyProgressQuerySchema } from './progress.schemas';

describe('progress schemas', () => {
  it('allows empty query or YYYY-MM-DD startDate', () => {
    expect(weeklyProgressQuerySchema.parse({})).toEqual({});
    expect(
      weeklyProgressQuerySchema.parse({ startDate: '2024-01-01' }),
    ).toEqual({ startDate: '2024-01-01' });
  });

  it('rejects invalid startDate format', () => {
    expect(() =>
      weeklyProgressQuerySchema.parse({ startDate: '01-01-2024' }),
    ).toThrow();
  });

  it('rejects impossible calendar dates', () => {
    expect(() =>
      weeklyProgressQuerySchema.parse({ startDate: '2024-99-99' }),
    ).toThrow();
    expect(() =>
      weeklyProgressQuerySchema.parse({ startDate: '2024-02-30' }),
    ).toThrow();
  });
});
