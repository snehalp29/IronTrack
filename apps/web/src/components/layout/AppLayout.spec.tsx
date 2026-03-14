import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AppLayout } from './AppLayout';

vi.mock('react-router-dom', () => ({
  NavLink: ({ to, children }: { to: string; children: string }) => (
    <a href={to}>{children}</a>
  ),
  Outlet: () => <section>OutletContent</section>,
}));

describe('AppLayout', () => {
  it('renders all navigation links and outlet', () => {
    const html = renderToStaticMarkup(<AppLayout />);

    expect(html).toContain('Dashboard');
    expect(html).toContain('Active Workout');
    expect(html).toContain('History');
    expect(html).toContain('Exercises');
    expect(html).toContain('Settings');
    expect(html).toContain('OutletContent');

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/workout/active"');
    expect(html).toContain('href="/history"');
    expect(html).toContain('href="/exercise/select"');
    expect(html).toContain('href="/settings"');
  });
});
