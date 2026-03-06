import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthSession,
  getAuthSession,
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
      refreshToken: 'refresh-token-123',
    });

    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
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
      refreshToken: 'refresh-token-123',
    });
    clearAuthSession();

    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
