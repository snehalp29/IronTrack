import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  exchangeGoogleIdToken,
  loginWithPassword,
  logoutCurrentSession,
  refreshStoredSession,
  registerWithPassword,
  signInWithGoogle,
} from './auth-service';
import {
  clearAuthSession,
  getAuthSession,
  persistAuthSession,
} from './auth-session';

const apiFetchMock = vi.hoisted(() => vi.fn());
const refreshAuthSessionMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  apiFetch: apiFetchMock,
  refreshAuthSession: refreshAuthSessionMock,
}));

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

describe('auth-service', () => {
  afterEach(() => {
    clearAuthSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('submits login credentials and persists the returned auth session', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    apiFetchMock.mockResolvedValue({
      accessToken: 'access-token-123',
    });

    await expect(
      loginWithPassword({
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token-123',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: {
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      },
    });
    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
    });
  });

  it('submits registration payload and persists the returned auth session', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    apiFetchMock.mockResolvedValue({
      accessToken: 'access-token-123',
    });

    await expect(
      registerWithPassword({
        name: 'Demo User',
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token-123',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      credentials: 'include',
      body: {
        name: 'Demo User',
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      },
    });
    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
    });
  });

  it('exchanges a Google ID token for an auth session and persists it', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    apiFetchMock.mockResolvedValue({
      accessToken: 'access-token-123',
    });

    await expect(
      exchangeGoogleIdToken('google-id-token-1234567890'),
    ).resolves.toEqual({
      accessToken: 'access-token-123',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/google', {
      method: 'POST',
      credentials: 'include',
      body: {
        idToken: 'google-id-token-1234567890',
      },
    });
    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
    });
  });

  it('uses an already-available Google Accounts API without waiting on script load events', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id-123');
    vi.stubGlobal('localStorage', createStorageMock());
    vi.stubGlobal('google', {
      accounts: {
        id: {
          initialize: vi.fn(
            ({
              callback,
            }: {
              callback: (response: { credential?: string }) => void;
            }) => {
              callback({ credential: 'google-id-token-1234567890' });
            },
          ),
          prompt: vi.fn(),
        },
      },
    });
    apiFetchMock.mockResolvedValue({
      accessToken: 'access-token-123',
    });

    await expect(signInWithGoogle()).resolves.toEqual({
      accessToken: 'access-token-123',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/google', {
      method: 'POST',
      credentials: 'include',
      body: {
        idToken: 'google-id-token-1234567890',
      },
    });
  });

  it('times out Google sign-in when the prompt never resolves', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id-123');
    vi.stubGlobal('google', {
      accounts: {
        id: {
          initialize: vi.fn(),
          prompt: vi.fn(),
        },
      },
    });

    const signInPromise = signInWithGoogle();
    const rejection = expect(signInPromise).rejects.toThrow(
      'Google sign-in timed out',
    );
    await vi.advanceTimersByTimeAsync(15_000);

    await rejection;
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('refreshes the stored auth session through the shared client refresh flow', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      accessToken: 'fresh-access-token',
    });

    await expect(refreshStoredSession()).resolves.toEqual({
      accessToken: 'fresh-access-token',
    });

    expect(refreshAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('logs out the current session and clears persisted auth state', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: 'access-token-123',
    });
    apiFetchMock.mockResolvedValue({ success: true });

    await expect(logoutCurrentSession()).resolves.toEqual({ success: true });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      skipAuthRefresh: true,
    });
    expect(getAuthSession()).toBeNull();
  });
});
