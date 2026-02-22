import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../services/apiClient';
import { sponsorService } from '../../services/sponsorService';
import { pointsService } from '../../services/pointsService';
import { Spinner } from '../../components/Spinner';
import type { SponsorRewardDefaults, ApiError } from '../../types';

interface SponsorDriver {
  driver_user_id: number;
  username: string;
  points_balance: number;
  first_name: string | null;
  last_name: string | null;
}

interface RecentActivity {
  date: string;
  driver_id: number;
  points_changed: number;
  reason: string | null;
  driver_first_name: string;
  driver_last_name: string;
}

interface DashboardData {
  activeDrivers: number;
  pendingApplications: number;
  totalPointsAllocated: number;
  dollarPerPoint: number;
  recentActivity: RecentActivity[];
}

export function SponsorDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [drivers, applications, defaults, activityRes] = await Promise.all([
        api.get<SponsorDriver[]>('/sponsor/drivers'),
        sponsorService.getPendingApplications(),
        pointsService.getSponsorRewardDefaults(),
        api.get<{ activity: RecentActivity[] }>('/api/sponsor/recent-activity?limit=5'),
      ]);

      const totalPoints = drivers.reduce((sum, d) => sum + (d.points_balance || 0), 0);

      setData({
        activeDrivers: drivers.length,
        pendingApplications: applications.length,
        totalPointsAllocated: totalPoints,
        dollarPerPoint: (defaults as SponsorRewardDefaults).dollar_per_point,
        recentActivity: activityRes.activity,
      });
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return <Spinner label="Loading dashboard..." />;
  }

  if (error || !data) {
    return (
      <section aria-labelledby="sponsor-dash-heading">
        <h2 id="sponsor-dash-heading">Sponsor Dashboard</h2>
        <div className="card mt-2">
          <p style={{ color: 'var(--color-danger)' }}>{error || 'Something went wrong.'}</p>
          <button className="btn btn-primary mt-1" onClick={loadDashboard} type="button">
            Retry
          </button>
        </div>
      </section>
    );
  }

  const driverName = (a: RecentActivity) => {
    const name = `${a.driver_first_name} ${a.driver_last_name}`.trim();
    return name || `Driver #${a.driver_id}`;
  };

  return (
    <section aria-labelledby="sponsor-dash-heading">
      <h2 id="sponsor-dash-heading">Sponsor Dashboard</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Welcome back, {user?.username}.
      </p>

      {/* Metric cards */}
      <div className="metrics-grid mt-2">
        <Link to="/sponsor/drivers" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="metric-card">
            <span className="metric-card-label">Active Drivers</span>
            <span className="metric-card-value">{data.activeDrivers}</span>
            <span className="metric-card-sub">enrolled drivers</span>
          </div>
        </Link>

        <Link to="/sponsor/applications" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="metric-card">
            <span className="metric-card-label">Pending Applications</span>
            <span className="metric-card-value">{data.pendingApplications}</span>
            <span className="metric-card-sub">awaiting review</span>
          </div>
        </Link>

        <Link to="/sponsor/points" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="metric-card">
            <span className="metric-card-label">Total Points Allocated</span>
            <span className="metric-card-value">{data.totalPointsAllocated.toLocaleString()}</span>
            <span className="metric-card-sub">across all drivers</span>
          </div>
        </Link>

        <Link to="/sponsor/reward-settings" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="metric-card">
            <span className="metric-card-label">Point Value</span>
            <span className="metric-card-value">${data.dollarPerPoint.toFixed(2)}</span>
            <span className="metric-card-sub">per point</span>
          </div>
        </Link>
      </div>

      {/* Recent activity */}
      <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>Recent Point Activity</h3>
      {data.recentActivity.length === 0 ? (
        <p className="placeholder-msg">No recent point activity.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="activity-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Driver</th>
                <th>Points</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.recentActivity.map((a, i) => (
                <tr key={i}>
                  <td>
                    {new Date(a.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td>{driverName(a)}</td>
                  <td className={a.points_changed >= 0 ? 'points-positive' : 'points-negative'}>
                    {a.points_changed >= 0 ? '+' : ''}
                    {a.points_changed}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>
                    {a.reason || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

