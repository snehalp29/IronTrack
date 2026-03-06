import { isValidElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';

type RouteNode = {
  path?: string;
  index?: boolean;
  children?: RouteNode[];
  element?: {
    props?: {
      children?: {
        type?: unknown;
      };
    };
    type?: unknown;
  };
};

const routerMock = vi.hoisted(() => ({ kind: 'router' }));
const createBrowserRouterMock = vi.hoisted(() =>
  vi.fn((routes: RouteNode[]) => {
    void routes;
    return routerMock;
  }),
);
const routerProviderMock = vi.hoisted(() =>
  vi.fn(({ router }: { router: unknown }) => (
    <div>RouterProvider:{router === routerMock ? 'ok' : 'bad'}</div>
  )),
);

vi.mock('react-router-dom', () => ({
  createBrowserRouter: createBrowserRouterMock,
  NavLink: ({ children }: { children: unknown }) => <>{children}</>,
  Outlet: () => <div>Outlet</div>,
  RouterProvider: routerProviderMock,
}));

describe('App', () => {
  it('creates browser router with expected routes and renders provider', () => {
    expect(createBrowserRouterMock).toHaveBeenCalledTimes(1);

    const routerCall = createBrowserRouterMock.mock.calls[0];
    expect(routerCall).toBeDefined();

    const routes = routerCall?.[0];
    expect(routes).toBeDefined();
    if (!routes) {
      throw new Error('Expected createBrowserRouter to receive routes');
    }
    expect(routes).toHaveLength(3);
    expect(routes.map((route) => route.path)).toEqual([
      '/login',
      '/register',
      '/',
    ]);

    const rootRoute = routes.find((route) => route.path === '/');
    expect(rootRoute).toBeDefined();
    expect(rootRoute?.element?.type).toBe(RequireAuth);
    expect(rootRoute?.element?.props?.children?.type).toBe(AppLayout);
    const childPaths = (rootRoute?.children ?? []).map((child) =>
      child.index ? '<index>' : child.path,
    );
    expect(childPaths).toContain('<index>');
    expect(childPaths).toContain('workout/active');
    expect(childPaths).toContain('exercise/:id');
    expect(childPaths).toContain('*');

    const view = App();
    expect(isValidElement(view)).toBe(true);

    const html = renderToStaticMarkup(view);
    expect(html).toContain('RouterProvider:ok');
    expect(routerProviderMock).toHaveBeenCalledWith(
      { router: routerMock },
      undefined,
    );
  });
});
