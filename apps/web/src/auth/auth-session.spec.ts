import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthSession,
  getAuthSession,
  isAccessTokenExpired,
  persistAuthSession,
  subscribeToAuthSession,
} from './auth-session';

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

describe('auth-session', () => {
  afterEach(() => {
    clearAuthSession();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists and loads the auth session from storage', () => {
    const storage = createStorageMock();
    vi.stubGlobal('localStorage', storage);

    persistAuthSession({
      accessToken: 'access-token-123',
    });

    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
    });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('normalizes legacy sessions by dropping refresh tokens from storage reads', () => {
    const storage = createStorageMock();
    storage.getItem.mockReturnValue(
      JSON.stringify({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      }),
    );
    vi.stubGlobal('localStorage', storage);

    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      'irontrack.auth.session',
      JSON.stringify({
        accessToken: 'access-token-123',
      }),
    );
  });

  it('drops malformed stored sessions instead of returning invalid auth state', () => {
    const storage = createStorageMock();
    storage.getItem.mockReturnValue('{"accessToken":123}');
    vi.stubGlobal('localStorage', storage);

    expect(getAuthSession()).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when auth session changes', () => {
    const storage = createStorageMock();
    vi.stubGlobal('localStorage', storage);
    const listener = vi.fn();

    const unsubscribe = subscribeToAuthSession(listener);

    persistAuthSession({
      accessToken: 'access-token-123',
    });
    clearAuthSession();

    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('returns the same snapshot object while the stored session is unchanged', () => {
    const storage = createStorageMock();
    vi.stubGlobal('localStorage', storage);

    persistAuthSession({
      accessToken: 'access-token-123',
    });

    const firstSnapshot = getAuthSession();
    const secondSnapshot = getAuthSession();

    expect(firstSnapshot).toBe(secondSnapshot);
  });

  it('detects expired access tokens from JWT exp claims', () => {
    const storage = createStorageMock();
    vi.stubGlobal('localStorage', storage);

    const validToken = createJwtWithExp(
      Math.floor(Date.now() / 1000) + 60 * 10,
    );
    const expiredToken = createJwtWithExp(
      Math.floor(Date.now() / 1000) - 60 * 10,
    );

    expect(isAccessTokenExpired(validToken)).toBe(false);
    expect(isAccessTokenExpired(expiredToken)).toBe(true);
    expect(isAccessTokenExpired('malformed-token')).toBe(true);
  });

  it('attaches and detaches the cross-tab storage listener with subscription lifecycle', async () => {
    vi.resetModules();

    const storage = createStorageMock();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener,
    } as unknown as Window);

    const authSession = await import('./auth-session');
    const unsubscribeOne = authSession.subscribeToAuthSession(vi.fn());
    const unsubscribeTwo = authSession.subscribeToAuthSession(vi.fn());

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith(
      'storage',
      expect.any(Function),
    );

    unsubscribeOne();
    expect(removeEventListener).not.toHaveBeenCalled();

    unsubscribeTwo();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith(
      'storage',
      addEventListener.mock.calls[0]?.[1],
    );
  });
});

function createJwtWithExp(exp: number): string {
  return [
    base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64UrlEncode(JSON.stringify({ exp })),
    'signature',
  ].join('.');
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
