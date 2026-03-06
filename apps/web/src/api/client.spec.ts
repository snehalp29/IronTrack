import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  clearAuthSession,
  getAuthSession,
  persistAuthSession,
} from '../auth/auth-session';
import {
  apiFetch,
  buildApiUrl,
  refreshAuthSession,
  resolveApiBaseUrl,
  setLoginRedirect,
} from './client';

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
}

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
    clearAuthSession();
    setLoginRedirect(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns parsed payload for a successful response', async () => {
    const payload = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/health')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/health',
      {
        headers: {},
      },
    );
  });

  it('validates parsed payloads against a runtime schema when one is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/health', {
        schema: z.object({
          ok: z.boolean(),
        }),
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      apiFetch('/health', {
        schema: z.object({
          status: z.literal('healthy'),
        }),
      }),
    ).rejects.toThrow('API response shape was invalid');
  });

  it('returns undefined for 204 no-content responses', async () => {
    const textMock = vi.fn().mockResolvedValue('');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: textMock,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/health')).resolves.toBeUndefined();
    expect(textMock).not.toHaveBeenCalled();
  });

  it('returns undefined when successful response declares zero content length', async () => {
    const textMock = vi.fn().mockResolvedValue('');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue('0') },
      text: textMock,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/health')).resolves.toBeUndefined();
    expect(textMock).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for empty successful bodies without content-length', async () => {
    const textMock = vi.fn().mockResolvedValue('');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue(null) },
      text: textMock,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/health')).resolves.toBeUndefined();
    expect(textMock).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for whitespace-only successful bodies', async () => {
    const textMock = vi.fn().mockResolvedValue('   \n\t');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: textMock,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/health')).resolves.toBeUndefined();
    expect(textMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes paths that omit the leading slash', async () => {
    const payload = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('health')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/health',
      {
        headers: {},
      },
    );
  });

  it('does not add content-type when there is no request body', async () => {
    const payload = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/health', { method: 'GET' })).resolves.toEqual(
      payload,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/health',
      {
        method: 'GET',
        headers: {},
      },
    );
  });

  it('merges custom request options and headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
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

  it('attaches bearer token from persisted auth session when caller does not provide one', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: 'access-token-123',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'GET',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer access-token-123',
        },
      },
    );
  });

  it('preserves explicit authorization header instead of overwriting it from persisted auth state', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: 'access-token-123',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer override-token',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer override-token',
        },
      },
    );
  });

  it('serializes plain object bodies as JSON and sets content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'POST',
      body: { name: 'Leg Day' } as unknown as BodyInit,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Leg Day' }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('does not add content-type for FormData bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('title', 'Leg Day');

    await apiFetch('/sessions', {
      method: 'POST',
      body: formData,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: formData,
        headers: {},
      },
    );
  });

  it('does not add content-type for Blob bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const blob = new Blob(['binary']);

    await apiFetch('/sessions', {
      method: 'POST',
      body: blob,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: blob,
        headers: {},
      },
    );
  });

  it('preserves headers passed as a Headers instance', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'POST',
      headers: new Headers({ Authorization: 'Bearer token' }),
      body: JSON.stringify({ name: 'Leg Day' }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/v1/sessions',
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ name: 'Leg Day' }));

    const headers = init?.headers as Record<string, string>;
    const authorization =
      headers.Authorization ?? headers.authorization ?? headers.AUTHORIZATION;
    const contentType =
      headers['Content-Type'] ??
      headers['content-type'] ??
      headers['CONTENT-TYPE'];
    expect(authorization).toBe('Bearer token');
    expect(contentType).toBe('application/json');
  });

  it('supports tuple-array headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'POST',
      headers: [['Authorization', 'Bearer token']],
      body: JSON.stringify({ name: 'Leg Day' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Leg Day' }),
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('does not overwrite an existing content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'raw body',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: 'raw body',
        headers: {
          'content-type': 'text/plain',
        },
      },
    );
  });

  it('does not auto-set JSON content-type for non-JSON string bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'POST',
      body: 'raw body',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: 'raw body',
        headers: {},
      },
    );
  });

  it('ignores undefined header values in object-style headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/sessions', {
      method: 'POST',
      headers: {
        Authorization: undefined,
        'X-Trace-Id': 'trace-123',
      } as unknown as HeadersInit,
      body: JSON.stringify({ name: 'Leg Day' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/sessions',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Leg Day' }),
        headers: {
          'X-Trace-Id': 'trace-123',
          'Content-Type': 'application/json',
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

  it('refreshes the auth session after a 401 and retries the original request once', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: 'expired-access-token',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: { message: 'expired' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            accessToken: 'fresh-access-token',
          }),
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/sessions')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/sessions',
      {
        headers: {
          Authorization: 'Bearer expired-access-token',
        },
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/auth/refresh',
      {
        method: 'POST',
        credentials: 'include',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/v1/sessions',
      {
        headers: {
          Authorization: 'Bearer fresh-access-token',
        },
      },
    );
    expect(getAuthSession()).toEqual({
      accessToken: 'fresh-access-token',
    });
  });

  it('deduplicates concurrent refresh requests across callers', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: 'expired-access-token',
    });

    let resolveRefreshResponse: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRefreshResponse = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const refreshOne = refreshAuthSession();
    const refreshTwo = refreshAuthSession();

    resolveRefreshResponse?.({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          accessToken: 'fresh-access-token',
        }),
      ),
    } as unknown as Response);

    await expect(Promise.all([refreshOne, refreshTwo])).resolves.toEqual([
      { accessToken: 'fresh-access-token' },
      { accessToken: 'fresh-access-token' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/refresh',
      {
        credentials: 'include',
        method: 'POST',
      },
    );
  });

  it('uses registered app navigation instead of a hard browser reload when auth recovery fails', async () => {
    const redirectToLogin = vi.fn();
    setLoginRedirect(redirectToLogin);
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: 'expired-access-token',
    });

    const assignMock = vi.fn();
    vi.stubGlobal('window', {
      location: {
        assign: assignMock,
        pathname: '/history',
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: { message: 'expired' },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: { message: 'refresh expired' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/sessions/s1')).rejects.toThrow('refresh expired');

    expect(getAuthSession()).toBeNull();
    expect(redirectToLogin).toHaveBeenCalledWith('/login');
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('falls back to status message when payload has no nested message', async () => {
    const assignMock = vi.fn();
    vi.stubGlobal('localStorage', createStorageMock());
    vi.stubGlobal('window', {
      location: {
        assign: assignMock,
        pathname: '/history',
      },
    });
    persistAuthSession({
      accessToken: 'access-token-123',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'invalid_token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/sessions/s1')).rejects.toThrow(
      'Request failed (401)',
    );
    expect(getAuthSession()).toBeNull();
    expect(assignMock).toHaveBeenCalledWith('/login');
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

describe('buildApiUrl', () => {
  it('joins base and slash-prefixed paths without duplication', () => {
    expect(buildApiUrl('https://api.irontrack.local/v1/', '/health')).toBe(
      'https://api.irontrack.local/v1/health',
    );
  });

  it('prepends slash when path is relative', () => {
    expect(buildApiUrl('https://api.irontrack.local/v1', 'health')).toBe(
      'https://api.irontrack.local/v1/health',
    );
  });
});
