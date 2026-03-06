import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  exchangeGoogleIdToken,
  loginWithPassword,
  registerWithPassword,
} from './auth-service';
import { clearAuthSession, getAuthSession } from './auth-session';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  apiFetch: apiFetchMock,
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('submits login credentials and persists the returned auth session', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    apiFetchMock.mockResolvedValue({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    await expect(
      loginWithPassword({
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: {
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      },
    });
    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });
  });

  it('submits registration payload and persists the returned auth session', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    apiFetchMock.mockResolvedValue({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    await expect(
      registerWithPassword({
        name: 'Demo User',
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: {
        name: 'Demo User',
        email: 'demo@irontrack.local',
        password: 'DemoPass123!',
      },
    });
    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });
  });

  it('exchanges a Google ID token for an auth session and persists it', async () => {
    vi.stubGlobal('localStorage', createStorageMock());
    apiFetchMock.mockResolvedValue({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    await expect(
      exchangeGoogleIdToken('google-id-token-1234567890'),
    ).resolves.toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/google', {
      method: 'POST',
      body: {
        idToken: 'google-id-token-1234567890',
      },
    });
    expect(getAuthSession()).toEqual({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });
  });
});
