import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-header">
        <h1>Good Driver Incentive Program</h1>

        {user && (
          <nav className="app-nav" aria-label="Main navigation">
            {user.role === 'driver' && (
              <NavLink to="/driver/profile">My Profile</NavLink>
            )}
            {user.role === 'sponsor' && (
              <NavLink to="/sponsor/profile">Sponsor Profile</NavLink>
            )}
            {user.role === 'admin' && (
              <NavLink to="/admin">Dashboard</NavLink>
            )}
            <NavLink to="/account/settings">Settings</NavLink>
            <Button variant="secondary" onClick={handleLogout} type="button">
              Log out
            </Button>
          </nav>
        )}
      </header>

      <main id="main-content" className="app-main">
        <Outlet />
      </main>
    </>
  );
}
