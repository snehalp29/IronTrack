import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, resolveApiBaseUrl } from './client';

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

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed payload for a successful response', async () => {
    const payload = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/health')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/health',
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });

  it('merges custom request options and headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: JSON.stringify({ name: 'Leg Day' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Leg Day' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
      },
    );
  });

  it('throws API error message when backend returns one', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        error: { message: 'Session is already finished' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/sessions/s1')).rejects.toThrow(
      'Session is already finished',
    );
  });

  it('falls back to status message when payload has no nested message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'invalid_token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/sessions/s1')).rejects.toThrow(
      'Request failed (401)',
    );
  });

  it('falls back to status message when nested message is not a string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: vi.fn().mockResolvedValue({ error: { message: 123 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/sessions/s1')).rejects.toThrow(
      'Request failed (422)',
    );
  });

  it('falls back to status message when parsing error payload fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/sessions/s1')).rejects.toThrow(
      'Request failed (500)',
    );
  });
});
