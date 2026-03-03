import { isValidElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

const renderMock = vi.hoisted(() => vi.fn());
const createRootMock = vi.hoisted(() =>
  vi.fn(() => ({
    render: renderMock,
  })),
);
const queryClientMock = vi.hoisted(() => ({ kind: 'query-client' }));
const queryClientCtorMock = vi.hoisted(() => vi.fn(() => queryClientMock));
const queryClientProviderMock = vi.hoisted(() =>
  vi.fn(({ children }: { client: unknown; children: unknown }) => (
    <>{children}</>
  )),
);
const appMock = vi.hoisted(() => vi.fn(() => <div>AppRoot</div>));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: queryClientCtorMock,
  QueryClientProvider: queryClientProviderMock,
}));

vi.mock('./App', () => ({
  App: appMock,
}));

vi.mock('./styles.css', () => ({}));

describe('main bootstrap', () => {
  it('creates query client and mounts app tree to #root', async () => {
    const rootElement = { id: 'root-node' };
    const getElementById = vi.fn(() => rootElement);
    vi.stubGlobal('document', {
      getElementById,
    } as unknown as Document);

    await import('./main');

    expect(getElementById).toHaveBeenCalledWith('root');
    expect(queryClientCtorMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(rootElement);
    expect(renderMock).toHaveBeenCalledTimes(1);

    const renderedTree = renderMock.mock.calls[0]?.[0];
    expect(isValidElement(renderedTree)).toBe(true);

    const strictModeElement = renderedTree as {
      props: {
        children: {
          type: unknown;
          props: { client: unknown; children: { type: unknown } };
        };
      };
    };
    const providerElement = strictModeElement.props.children;
    expect(providerElement.type).toBe(queryClientProviderMock);
    expect(providerElement.props.client).toBe(queryClientMock);
    expect(providerElement.props.children.type).toBe(appMock);
  });
});
