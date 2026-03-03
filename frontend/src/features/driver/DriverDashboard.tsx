import { useAuth } from '../../auth/AuthContext';
import DriverTips from '../../components/DriverTips';

export function DriverDashboardPage() {
  const { user } = useAuth();

  return (
    <section aria-labelledby="driver-dash-heading">
      <h2 id="driver-dash-heading">Driver Dashboard</h2>
      <p className="mt-1">Welcome back, {user?.username}.</p>

      <div className="placeholder-grid mt-2">
        <div className="card">
          <h3>Points Balance</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>

        <div className="card">
          <h3>Recent Orders</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>

        <div className="card">
          <h3>Sponsor</h3>
          <p className="placeholder-value">--</p>
          <p className="helper-text">Coming soon</p>
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-3">
        <div className="card">
          <h3>Driving Tips</h3>
          <DriverTips />
        </div>
      </div>
    </section>
  );
}