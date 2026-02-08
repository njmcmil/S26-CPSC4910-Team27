import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types';

const ROLE_HOME: Record<UserRole, string> = {
  driver: '/driver/dashboard',
  sponsor: '/sponsor/dashboard',
  admin: '/admin/dashboard',
};

export function PublicLayout() {
  const { user } = useAuth();

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-header" role="banner">
        <Link to="/" className="app-logo-link">
          Good Driver Incentive Program
        </Link>
        <nav className="app-nav" aria-label="Public navigation">
          <Link to="/about">About</Link>
          {user ? (
            <Link to={ROLE_HOME[user.role]} className="btn btn-secondary btn-sm">
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-secondary btn-sm">
              Sign In
            </Link>
          )}
        </nav>
      </header>

      <main id="main-content" className="app-main">
        <Outlet />
      </main>
    </>
  );
}