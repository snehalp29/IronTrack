import { describe, expect, it } from 'vitest';

import { emailSchema, paginationSchema, passwordSchema } from '../validation';

describe('shared validation', () => {
  it('accepts valid auth inputs', () => {
    expect(emailSchema.parse('athlete@irontrack.app')).toBe(
      'athlete@irontrack.app',
    );
    expect(passwordSchema.parse('StrongPass1')).toBe('StrongPass1');
  });

  it('rejects invalid emails and weak passwords', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(passwordSchema.safeParse('nocaps123').success).toBe(false);
    expect(passwordSchema.safeParse('NOLOWER123').success).toBe(false);
    expect(passwordSchema.safeParse('NoNumber').success).toBe(false);
  });

  it('coerces pagination values and applies defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('rejects invalid pagination values', () => {
    expect(paginationSchema.safeParse({ page: 0, pageSize: 20 }).success).toBe(
      false,
    );
    expect(paginationSchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(
      false,
    );
  });
});
