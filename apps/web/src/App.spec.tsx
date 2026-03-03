import { isValidElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

const routerMock = vi.hoisted(() => ({ kind: 'router' }));
const createBrowserRouterMock = vi.hoisted(() => vi.fn(() => routerMock));
const routerProviderMock = vi.hoisted(() =>
  vi.fn(({ router }: { router: unknown }) => (
    <div>RouterProvider:{router === routerMock ? 'ok' : 'bad'}</div>
  )),
);

vi.mock('react-router-dom', () => ({
  createBrowserRouter: createBrowserRouterMock,
  RouterProvider: routerProviderMock,
}));

describe('App', () => {
  it('creates browser router with expected routes and renders provider', () => {
    expect(createBrowserRouterMock).toHaveBeenCalledTimes(1);

    const routes = createBrowserRouterMock.mock.calls[0]?.[0] as Array<{
      path?: string;
      children?: Array<{ path?: string; index?: boolean }>;
    }>;
    expect(routes).toHaveLength(3);
    expect(routes.map((route) => route.path)).toEqual([
      '/login',
      '/register',
      '/',
    ]);

    const rootRoute = routes.find((route) => route.path === '/');
    expect(rootRoute).toBeDefined();
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
