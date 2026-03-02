import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from './client';

describe('resolveApiBaseUrl', () => {
  it('uses configured API URL when it is non-empty', () => {
    expect(resolveApiBaseUrl('https://api.irontrack.local/v1')).toBe(
      'https://api.irontrack.local/v1',
    );
  });

  it('falls back to default API URL when env value is undefined', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://localhost:3000/api/v1');
  });

  it('falls back to default API URL when env value is empty', () => {
    expect(resolveApiBaseUrl('')).toBe('http://localhost:3000/api/v1');
  });

  it('falls back to default API URL when env value is whitespace only', () => {
    expect(resolveApiBaseUrl('   \t  ')).toBe('http://localhost:3000/api/v1');
  });
});
