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

const routerNavigateMock = vi.hoisted(() => vi.fn());
const routerMock = vi.hoisted(() => ({
  kind: 'router',
  navigate: routerNavigateMock,
}));
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
const setLoginRedirectMock = vi.hoisted(() => vi.fn());
const activeWorkoutState = vi.hoisted(() => ({
  state: 'IDLE' as 'IDLE' | 'COMPLETED',
  summary: undefined as unknown,
}));

vi.mock('react-router-dom', () => ({
  createBrowserRouter: createBrowserRouterMock,
  Navigate: ({ replace, to }: { replace?: boolean; to: string }) => (
    <div data-replace={String(replace)} data-to={to}>
      Navigate
    </div>
  ),
  NavLink: ({ children }: { children: unknown }) => <>{children}</>,
  Outlet: () => <div>Outlet</div>,
  RouterProvider: routerProviderMock,
}));

vi.mock('./api/client', () => ({
  setLoginRedirect: setLoginRedirectMock,
}));

vi.mock('./stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: (
    selector: (state: {
      state: 'IDLE' | 'COMPLETED';
      completeSummary: unknown;
    }) => unknown,
  ) =>
    selector({
      state: activeWorkoutState.state,
      completeSummary: activeWorkoutState.summary,
    }),
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

  it('registers login redirects against the router navigate API', () => {
    const redirectHandler = setLoginRedirectMock.mock.calls[0]?.[0] as
      | ((path: string) => void)
      | undefined;

    expect(redirectHandler).toBeTypeOf('function');
    redirectHandler?.('/login');

    expect(routerNavigateMock).toHaveBeenCalledWith('/login', {
      replace: true,
    });
  });

  it('guards completion routes until the workout store has a completed summary', () => {
    const routerCall = createBrowserRouterMock.mock.calls[0];
    const routes = routerCall?.[0] ?? [];
    const rootRoute = routes.find((route) => route.path === '/');
    const completionRoute = rootRoute?.children?.find(
      (route) => route.path === 'workout/complete',
    );
    const completionElement = completionRoute?.element;

    expect(completionElement).toBeDefined();
    if (!completionElement) {
      throw new Error('Expected completion route element');
    }

    activeWorkoutState.state = 'IDLE';
    activeWorkoutState.summary = undefined;
    const blocked = (
      completionElement.type as (props: { children: unknown }) => unknown
    )(completionElement.props);
    expect(
      renderToStaticMarkup(
        blocked as Parameters<typeof renderToStaticMarkup>[0],
      ),
    ).toContain('data-to="/workout/active"');

    activeWorkoutState.state = 'COMPLETED';
    activeWorkoutState.summary = { totalVolume: 1 };
    const allowed = (
      completionElement.type as (props: { children: unknown }) => unknown
    )(completionElement.props);
    expect(
      (allowed as { props?: { children?: { type?: unknown } } }).props?.children
        ?.type,
    ).toBe(completionElement.props.children.type);
  });
});
