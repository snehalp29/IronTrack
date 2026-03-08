import { BadRequestException } from '@nestjs/common';

import { isValidTimezone, normalizeTimezoneOrThrow } from './timezone';

describe('timezone validation helpers', () => {
  it('returns undefined when both the input and fallback are blank', () => {
    expect(normalizeTimezoneOrThrow('   ', '   ')).toBeUndefined();
    expect(normalizeTimezoneOrThrow(undefined)).toBeUndefined();
  });

  it('returns a trimmed fallback timezone when the input is blank', () => {
    expect(normalizeTimezoneOrThrow('   ', ' UTC ')).toBe('UTC');
  });

  it('throws when the resolved timezone is invalid', () => {
    expect(() => normalizeTimezoneOrThrow('Mars/Olympus')).toThrow(
      BadRequestException,
    );
  });

  it('reports timezone validity using Intl.DateTimeFormat', () => {
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
  });
});
