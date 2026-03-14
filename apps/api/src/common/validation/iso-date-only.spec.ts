import { isIsoDateOnly, isoDateOnlySchema } from './iso-date-only';

describe('isoDateOnly', () => {
  it('accepts valid YYYY-MM-DD calendar dates', () => {
    expect(isIsoDateOnly('2024-02-29')).toBe(true);
    expect(isoDateOnlySchema.parse('2024-01-31')).toBe('2024-01-31');
  });

  it('rejects invalid date format', () => {
    expect(isIsoDateOnly('2024/01/01')).toBe(false);
    expect(() => isoDateOnlySchema.parse('01-01-2024')).toThrow();
  });

  it('rejects impossible calendar dates', () => {
    expect(isIsoDateOnly('2024-99-99')).toBe(false);
    expect(isIsoDateOnly('2024-02-30')).toBe(false);
    expect(() => isoDateOnlySchema.parse('2024-04-31')).toThrow();
  });
});
