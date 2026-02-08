import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { UserRole } from '../types';

interface RoleGuardProps {
  allowed: UserRole[];
}

export function RoleGuard({ allowed }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (!allowed.includes(user.role)) {
    return (
      <main className="app-main">
        <div className="card text-center" role="alert">
          <h2>Access Denied</h2>
          <p className="mt-1">
            You do not have permission to view this page.
          </p>
        </div>
      </main>
    );
  }

  return <Outlet />;
}
