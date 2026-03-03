import { z } from 'zod';

import { optionalTrimmed } from './optional-trimmed';

describe('optionalTrimmed', () => {
  it('trims non-empty strings', () => {
    const schema = optionalTrimmed(z.string().min(2).max(8));

    expect(schema.parse('  value  ')).toBe('value');
  });

  it('maps blank strings to undefined', () => {
    const schema = optionalTrimmed(z.string().min(2).max(8));

    expect(schema.parse('   ')).toBeUndefined();
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it('still enforces the provided schema after trimming', () => {
    const schema = optionalTrimmed(z.string().min(2).max(8));

    expect(() => schema.parse(' x ')).toThrow();
  });
});
