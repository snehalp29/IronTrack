import { useSyncExternalStore } from 'react';

export interface AuthSession {
  accessToken: string;
}

const AUTH_SESSION_STORAGE_KEY = 'irontrack.auth.session';
const listeners = new Set<() => void>();
let storageEventHandler: ((event: StorageEvent) => void) | null = null;
let cachedRawSession: string | null | undefined;
let cachedSession: AuthSession | null = null;

type AuthStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export function getAuthSession(): AuthSession | null {
  const storage = getAuthStorage();
  if (!storage) {
    return null;
  }

  const rawSession = storage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (rawSession === cachedRawSession && cachedRawSession !== undefined) {
    return cachedSession;
  }

  if (!rawSession) {
    updateCachedSession(null, null);
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as unknown;
    const normalizedSession = normalizeStoredAuthSession(parsed);
    if (!normalizedSession) {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
      updateCachedSession(null, null);
      return null;
    }

    const normalizedRawSession = JSON.stringify(normalizedSession);
    if (normalizedRawSession !== rawSession) {
      storage.setItem(AUTH_SESSION_STORAGE_KEY, normalizedRawSession);
    }

    updateCachedSession(normalizedRawSession, normalizedSession);
    return normalizedSession;
  } catch {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
    updateCachedSession(null, null);
    return null;
  }
}

export function persistAuthSession(session: AuthSession): AuthSession {
  const normalizedSession = normalizeAuthSession(session);
  const rawSession = JSON.stringify(normalizedSession);
  const storage = getAuthStorage();
  storage?.setItem(AUTH_SESSION_STORAGE_KEY, rawSession);
  updateCachedSession(rawSession, normalizedSession);
  emitAuthSessionChange();
  return normalizedSession;
}

export function clearAuthSession(): void {
  const storage = getAuthStorage();
  storage?.removeItem(AUTH_SESSION_STORAGE_KEY);
  updateCachedSession(null, null);
  emitAuthSessionChange();
}

export function subscribeToAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  initializeStorageSync();
  return () => {
    listeners.delete(listener);
    teardownStorageSyncIfIdle();
  };
}

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSession,
    getAuthSession,
  );
}

export function isAccessTokenExpired(
  accessToken: string,
  nowMs = Date.now(),
): boolean {
  const exp = readJwtExpiry(accessToken);
  if (!exp) {
    return true;
  }

  return exp * 1000 <= nowMs;
}

function getAuthStorage(): AuthStorage | null {
  const maybeStorage = (
    globalThis as typeof globalThis & {
      localStorage?: AuthStorage;
    }
  ).localStorage;

  if (!maybeStorage) {
    return null;
  }

  return maybeStorage;
}

function normalizeAuthSession(session: AuthSession): AuthSession {
  const normalizedSession = normalizeStoredAuthSession(session);
  if (!normalizedSession) {
    throw new Error('Auth session payload is invalid');
  }

  return normalizedSession;
}

function normalizeStoredAuthSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybeSession = value as { accessToken?: unknown };
  if (
    typeof maybeSession.accessToken !== 'string' ||
    maybeSession.accessToken.length === 0
  ) {
    return null;
  }

  return {
    accessToken: maybeSession.accessToken,
  };
}

function updateCachedSession(
  rawSession: string | null,
  session: AuthSession | null,
): void {
  cachedRawSession = rawSession;
  cachedSession = session;
}

function emitAuthSessionChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function initializeStorageSync(): void {
  if (storageEventHandler) {
    return;
  }

  const maybeWindow = (
    globalThis as typeof globalThis & {
      window?: Window;
    }
  ).window;

  if (!maybeWindow || typeof maybeWindow.addEventListener !== 'function') {
    return;
  }

  storageEventHandler = (event: StorageEvent) => {
    if (event.key === AUTH_SESSION_STORAGE_KEY) {
      emitAuthSessionChange();
    }
  };

  maybeWindow.addEventListener('storage', storageEventHandler);
}

function teardownStorageSyncIfIdle(): void {
  if (listeners.size > 0 || !storageEventHandler) {
    return;
  }

  const maybeWindow = (
    globalThis as typeof globalThis & {
      window?: Window;
    }
  ).window;

  if (maybeWindow && typeof maybeWindow.removeEventListener === 'function') {
    maybeWindow.removeEventListener('storage', storageEventHandler);
  }

  storageEventHandler = null;
}

function readJwtExpiry(accessToken: string): number | null {
  const payload = accessToken.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '=',
    );
    const decodedText = decodeBase64(paddedPayload);
    const decodedPayload = JSON.parse(decodedText) as { exp?: unknown };

    if (
      typeof decodedPayload.exp === 'number' &&
      Number.isFinite(decodedPayload.exp)
    ) {
      return decodedPayload.exp;
    }

    return null;
  } catch {
    return null;
  }
}

function decodeBase64(value: string): string {
  if (typeof atob === 'function') {
    return atob(value);
  }

  const maybeBuffer = (
    globalThis as typeof globalThis & {
      Buffer?: {
        from: (
          input: string,
          encoding: string,
        ) => { toString: (encoding: string) => string };
      };
    }
  ).Buffer;

  if (!maybeBuffer) {
    throw new Error('Base64 decoding is not available');
  }

  return maybeBuffer.from(value, 'base64').toString('utf8');
}
