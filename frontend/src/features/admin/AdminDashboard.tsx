import { useAuth } from '../../auth/AuthContext';

export function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <section aria-labelledby="admin-heading">
      <h2 id="admin-heading">Admin Dashboard</h2>
      <p className="mt-1">Welcome back, {user?.username}.</p>

      <div className="placeholder-grid mt-2">
        <div className="card">
          <h3>Total Users</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>
        <div className="card">
          <h3>Active Sponsors</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>
        <div className="card">
          <h3>Recent Activity</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>
      </div>
    </section>
  );
}
