import { useSyncExternalStore } from 'react';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

const AUTH_SESSION_STORAGE_KEY = 'irontrack.auth.session';
const listeners = new Set<() => void>();
let storageSyncInitialized = false;

type AuthStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export function getAuthSession(): AuthSession | null {
  const storage = getAuthStorage();
  if (!storage) {
    return null;
  }

  const rawSession = storage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as unknown;
    if (!isAuthSession(parsed)) {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

export function persistAuthSession(session: AuthSession): AuthSession {
  const normalizedSession = normalizeAuthSession(session);
  const storage = getAuthStorage();
  storage?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
  emitAuthSessionChange();
  return normalizedSession;
}

export function clearAuthSession(): void {
  const storage = getAuthStorage();
  storage?.removeItem(AUTH_SESSION_STORAGE_KEY);
  emitAuthSessionChange();
}

export function subscribeToAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  initializeStorageSync();
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSession,
    getAuthSession,
  );
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
  if (!isAuthSession(session)) {
    throw new Error('Auth session payload is invalid');
  }

  return session;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeSession = value as Partial<AuthSession>;
  return (
    typeof maybeSession.accessToken === 'string' &&
    maybeSession.accessToken.length > 0 &&
    typeof maybeSession.refreshToken === 'string' &&
    maybeSession.refreshToken.length > 0
  );
}

function emitAuthSessionChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function initializeStorageSync(): void {
  if (storageSyncInitialized) {
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

  maybeWindow.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === AUTH_SESSION_STORAGE_KEY) {
      emitAuthSessionChange();
    }
  });
  storageSyncInitialized = true;
}
