import { useAuth } from '../../auth/AuthContext';

export function SponsorDashboardPage() {
  const { user } = useAuth();

  return (
    <section aria-labelledby="sponsor-dash-heading">
      <h2 id="sponsor-dash-heading">Sponsor Dashboard</h2>
      <p className="mt-1">Welcome back, {user?.username}.</p>

      <div className="placeholder-grid mt-2">
        <div className="card">
          <h3>Active Drivers</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>
        <div className="card">
          <h3>Pending Applications</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>
        <div className="card">
          <h3>Points Allocated</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>
      </div>
    </section>
  );
}
