import { startOfWeek } from './dates';

describe('date utils', () => {
  it('returns Monday of the same week for weekdays', () => {
    expect(startOfWeek(new Date('2026-02-26T12:00:00.000Z'))).toEqual(
      new Date('2026-02-23T00:00:00.000Z'),
    );
  });

  it('returns the previous Monday when date is Sunday', () => {
    expect(startOfWeek(new Date('2026-03-01T12:00:00.000Z'))).toEqual(
      new Date('2026-02-23T00:00:00.000Z'),
    );
  });
});
