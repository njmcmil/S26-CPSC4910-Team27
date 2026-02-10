import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types';

const ROLE_HOME: Record<UserRole, string> = {
  driver: '/driver/dashboard',
  sponsor: '/sponsor/dashboard',
  admin: '/admin/dashboard',
};

export function HomePage() {
  const { user } = useAuth();

  return (
    <section className="card" aria-labelledby="home-heading">
      <h2 id="home-heading">Welcome to the Good Driver Incentive Program</h2>
      <p className="mt-1">
        Rewarding safe driving through a points-based incentive system.
        Sponsors create catalogs of rewards, and drivers earn points for good
        driving behavior that they can redeem in those catalogs.
      </p>

      <div className="home-features mt-2">
        <div className="feature-item">
          <h3>Drivers</h3>
          <p>Earn points for safe driving habits and redeem them for rewards in your sponsor's catalog.</p>
        </div>
        <div className="feature-item">
          <h3>Sponsors</h3>
          <p>Create reward catalogs, manage driver applications, and track points to encourage safe driving.</p>
        </div>
        <div className="feature-item">
          <h3>Admins</h3>
          <p>Oversee the platform, manage users and sponsors, and access comprehensive reports.</p>
        </div>
      </div>

      <div className="mt-2">
        {user ? (
          <Link to={ROLE_HOME[user.role]} className="btn btn-primary">
            Go to Dashboard
          </Link>
        ) : (
          <Link to="/login" className="btn btn-primary">
            Sign In to Get Started
          </Link>
        )}
      </div>
    </section>
  );
}
