import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from './RequireAuth';
import { clearAuthSession, persistAuthSession } from './auth-session';

const refreshStoredSessionMock = vi.hoisted(() => vi.fn());

const navigateMock = vi.hoisted(() =>
  vi.fn(({ to }: { replace?: boolean; to: string }) => (
    <div>Navigate:{to}</div>
  )),
);

vi.mock('react-router-dom', () => ({
  Navigate: navigateMock,
}));

vi.mock('./auth-service', () => ({
  refreshStoredSession: refreshStoredSessionMock,
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

describe('RequireAuth', () => {
  afterEach(() => {
    clearAuthSession();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated visitors to the login route', () => {
    vi.stubGlobal('localStorage', createStorageMock());

    const html = renderToStaticMarkup(
      <RequireAuth>
        <div>Protected content</div>
      </RequireAuth>,
    );

    expect(html).toContain('Navigate:/login');
    expect(navigateMock).toHaveBeenCalledWith(
      { replace: true, to: '/login' },
      undefined,
    );
  });

  it('renders protected content when a persisted auth session exists', () => {
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: createJwtWithExp(Math.floor(Date.now() / 1000) + 60 * 10),
    });

    const html = renderToStaticMarkup(
      <RequireAuth>
        <div>Protected content</div>
      </RequireAuth>,
    );

    expect(html).toContain('Protected content');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows a session restore placeholder while an expired access token is being refreshed', () => {
    vi.stubGlobal('localStorage', createStorageMock());
    persistAuthSession({
      accessToken: createJwtWithExp(Math.floor(Date.now() / 1000) - 60 * 10),
    });

    const html = renderToStaticMarkup(
      <RequireAuth>
        <div>Protected content</div>
      </RequireAuth>,
    );

    expect(html).toContain('Restoring session');
    expect(navigateMock).not.toHaveBeenCalled();
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
