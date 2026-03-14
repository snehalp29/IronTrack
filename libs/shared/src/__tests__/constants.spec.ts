import { describe, expect, it } from 'vitest';

import { API_PREFIX } from '../constants';

describe('shared constants', () => {
  it('keeps API_PREFIX aligned with backend env default format', () => {
    expect(API_PREFIX).toBe('api/v1');
    expect(API_PREFIX.startsWith('/')).toBe(false);
  });
});
