import { trimString, trimStringOrUndefined } from './string-normalization';

describe('string normalization helpers', () => {
  it('trims string values while preserving non-string values', () => {
    expect(trimString('  value  ')).toBe('value');
    expect(trimString('')).toBe('');
    expect(trimString(123)).toBe(123);
    expect(trimString(undefined)).toBeUndefined();
  });

  it('maps blank strings to undefined and trims non-empty strings', () => {
    expect(trimStringOrUndefined('  value  ')).toBe('value');
    expect(trimStringOrUndefined('   ')).toBeUndefined();
    expect(trimStringOrUndefined('\n\t')).toBeUndefined();
    expect(trimStringOrUndefined(123)).toBe(123);
    expect(trimStringOrUndefined(undefined)).toBeUndefined();
  });
});
