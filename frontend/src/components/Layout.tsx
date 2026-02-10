import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
import type { UserRole } from '../types';

interface NavItem {
  to: string;
  label: string;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  driver: [
    { to: '/driver/dashboard', label: 'Dashboard' },
    { to: '/driver/catalog', label: 'Catalog' },
    { to: '/driver/orders', label: 'My Orders' },
    { to: '/driver/profile', label: 'Profile' },
    { to: '/driver/settings', label: 'Settings' },
    { to: '/about', label: 'About' },
  ],
  sponsor: [
    { to: '/sponsor/dashboard', label: 'Dashboard' },
    { to: '/sponsor/applications', label: 'Applications' },
    { to: '/sponsor/drivers', label: 'Drivers' },
    { to: '/sponsor/points', label: 'Points' },
    { to: '/sponsor/catalog', label: 'Catalog' },
    { to: '/sponsor/reports', label: 'Reports' },
    { to: '/sponsor/profile', label: 'Sponsor Profile' },
    { to: '/sponsor/settings', label: 'Settings' },
    { to: '/about', label: 'About' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/sponsors', label: 'Sponsors' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/audit-logs', label: 'Audit Logs' },
    { to: '/admin/settings', label: 'Settings' },
    { to: '/about', label: 'About' },
  ],
};

const ROLE_LABELS: Record<UserRole, string> = {
  driver: 'Driver',
  sponsor: 'Sponsor',
  admin: 'Admin',
};

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = user ? NAV_ITEMS[user.role] ?? [] : [];

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-header" role="banner">
        <span className="app-title">Good Driver Incentive Program</span>

        {user && (
          <div className="header-actions">
            <span
              className={`role-badge role-${user.role}`}
              aria-label={`Role: ${ROLE_LABELS[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
            <span className="header-username">{user.username}</span>
            <Button variant="secondary" onClick={handleLogout} type="button">
              Log out
            </Button>
          </div>
        )}
      </header>

      <div className="app-shell">
        {user && (
          <nav className="app-sidebar" aria-label="Main navigation">
            <ul className="sidebar-nav" role="list">
              {items.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      isActive ? 'nav-link active' : 'nav-link'
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main id="main-content" className="app-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
