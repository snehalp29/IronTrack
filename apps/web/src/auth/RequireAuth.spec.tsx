import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from './RequireAuth';
import { clearAuthSession, persistAuthSession } from './auth-session';

const navigateMock = vi.hoisted(() =>
  vi.fn(({ to }: { replace?: boolean; to: string }) => (
    <div>Navigate:{to}</div>
  )),
);

vi.mock('react-router-dom', () => ({
  Navigate: navigateMock,
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
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
    });

    const html = renderToStaticMarkup(
      <RequireAuth>
        <div>Protected content</div>
      </RequireAuth>,
    );

    expect(html).toContain('Protected content');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
