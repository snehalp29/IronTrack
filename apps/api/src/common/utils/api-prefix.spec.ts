import { DEFAULT_API_PREFIX, normalizeApiPrefix } from './api-prefix';

describe('api prefix utils', () => {
  it('returns the default when prefix is undefined', () => {
    expect(normalizeApiPrefix(undefined)).toBe(DEFAULT_API_PREFIX);
  });

  it('normalizes configured prefixes with leading/trailing slashes and spaces', () => {
    expect(normalizeApiPrefix(' /api/v1/ ')).toBe('api/v1');
  });

  it('returns fallback when prefix normalizes to an empty value', () => {
    expect(normalizeApiPrefix('///', '/internal/v2/')).toBe('internal/v2');
  });

  it('falls back to hard default when both prefix and fallback normalize empty', () => {
    expect(normalizeApiPrefix('   ', '///')).toBe(DEFAULT_API_PREFIX);
  });
});
