import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/workout/active', label: 'Active Workout' },
  { to: '/history', label: 'History' },
  { to: '/exercise/select', label: 'Exercises' },
  { to: '/settings', label: 'Settings' },
];

export function AppLayout() {
  return (
    <div className="layout">
      <nav className="nav">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
