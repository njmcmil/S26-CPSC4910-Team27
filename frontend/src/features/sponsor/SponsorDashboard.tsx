import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../services/apiClient';
import { sponsorService } from '../../services/sponsorService';
import { pointsService } from '../../services/pointsService';
import { Spinner } from '../../components/Spinner';
import type { SponsorRewardDefaults, ApiError } from '../../types';
import SponsorTips from './SponsorTips';

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
      const [driversRes, applicationsRes, defaultsRes, activityRes] = await Promise.allSettled([
        api.get<SponsorDriver[]>('/sponsor/drivers'),
        sponsorService.getPendingApplications(),
        pointsService.getSponsorRewardDefaults(),
        api.get<{ activity: RecentActivity[] }>('/api/sponsor/recent-activity?limit=5'),
      ]);

      const drivers = driversRes.status === 'fulfilled' ? driversRes.value : [];
      const applications = applicationsRes.status === 'fulfilled' ? applicationsRes.value : [];
      const defaults = defaultsRes.status === 'fulfilled'
        ? defaultsRes.value
        : ({
            dollar_per_point: 0,
            earn_rate: 0,
            expiration_days: null,
            max_points_per_day: null,
            max_points_per_month: null,
          } as SponsorRewardDefaults);
      const recentActivity = activityRes.status === 'fulfilled' ? activityRes.value.activity : [];

      if (
        driversRes.status === 'rejected' &&
        applicationsRes.status === 'rejected' &&
        defaultsRes.status === 'rejected' &&
        activityRes.status === 'rejected'
      ) {
        throw new Error('Failed to load dashboard data.');
      }

      const totalPoints = drivers.reduce(
        (sum, d) => sum + (d.points_balance || 0),
        0
      );

      setData({
        activeDrivers: drivers.length,
        pendingApplications: applications.length,
        totalPointsAllocated: totalPoints,
        dollarPerPoint: defaults.dollar_per_point,
        recentActivity,
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
          <p style={{ color: 'var(--color-danger)' }}>
            {error || 'Something went wrong.'}
          </p>
          <button
            className="btn btn-primary mt-1"
            onClick={loadDashboard}
            type="button"
          >
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

      <div className="dashboard-tabbar">
        <Link to="/sponsor/drivers" className="dashboard-tablink">Drivers</Link>
        <Link to="/sponsor/points" className="dashboard-tablink">Points</Link>
        <Link to="/sponsor/reports" className="dashboard-tablink">Reports</Link>
        <Link to="/sponsor/catalog" className="dashboard-tablink">Catalog</Link>
        <Link to="/sponsor/profile" className="dashboard-tablink">Edit Profile</Link>
      </div>

      {/* ================= METRICS ================= */}
      <div className="metrics-grid mt-2">
        <Link
          to="/sponsor/drivers"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="metric-card">
            <span className="metric-card-label">Active Drivers</span>
            <span className="metric-card-value">{data.activeDrivers}</span>
            <span className="metric-card-sub">enrolled drivers</span>
          </div>
        </Link>

        <Link
          to="/sponsor/applications"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="metric-card">
            <span className="metric-card-label">
              Pending Applications
            </span>
            <span className="metric-card-value">
              {data.pendingApplications}
            </span>
            <span className="metric-card-sub">awaiting review</span>
          </div>
        </Link>

        <Link
          to="/sponsor/points"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="metric-card">
            <span className="metric-card-label">
              Total Points Allocated
            </span>
            <span className="metric-card-value">
              {data.totalPointsAllocated.toLocaleString()}
            </span>
            <span className="metric-card-sub">
              across all drivers
            </span>
          </div>
        </Link>

        <Link
          to="/sponsor/reward-settings"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="metric-card">
            <span className="metric-card-label">Point Value</span>
            <span className="metric-card-value">
              ${data.dollarPerPoint.toFixed(2)}
            </span>
            <span className="metric-card-sub">per point</span>
          </div>
        </Link>
      </div>

      <div className="dashboard-overview-grid mt-2">
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="dashboard-action-list">
            <Link to="/sponsor/applications" className="dashboard-action-card">
              <strong>Review Applications</strong>
              <span>Approve or reject pending drivers for your program.</span>
            </Link>
            <Link to="/sponsor/points" className="dashboard-action-card">
              <strong>Adjust Points</strong>
              <span>Add, deduct, or bulk-update driver balances.</span>
            </Link>
            <Link to="/sponsor/reports" className="dashboard-action-card">
              <strong>Generate Reports</strong>
              <span>Inspect driver behavior and point activity with filters.</span>
            </Link>
            <Link to="/sponsor/profile" className="dashboard-action-card">
              <strong>Edit Profile</strong>
              <span>Update sponsor contact details, company information, and organization settings.</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h3>Program Snapshot</h3>
          <div className="dashboard-list">
            <div className="dashboard-list-row">
              <div>
                <div className="dashboard-list-title">Active drivers</div>
                <div className="dashboard-list-sub">Currently enrolled and earning</div>
              </div>
              <strong>{data.activeDrivers}</strong>
            </div>
            <div className="dashboard-list-row">
              <div>
                <div className="dashboard-list-title">Pending applications</div>
                <div className="dashboard-list-sub">Awaiting sponsor review</div>
              </div>
              <strong>{data.pendingApplications}</strong>
            </div>
            <div className="dashboard-list-row">
              <div>
                <div className="dashboard-list-title">Points allocated</div>
                <div className="dashboard-list-sub">Current total across active drivers</div>
              </div>
              <strong>{data.totalPointsAllocated.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ================= RECENT ACTIVITY ================= */}
      <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>
        Recent Point Activity
      </h3>

      {data.recentActivity.length === 0 ? (
        <p className="placeholder-msg">
          No recent point activity.
        </p>
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
                  <td
                    className={
                      a.points_changed >= 0
                        ? 'points-positive'
                        : 'points-negative'
                    }
                  >
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

      <h3 style={{ marginTop: '2.5rem', marginBottom: '0.75rem' }}>
        Catalog And Points Tips
      </h3>

      <div className="card">
        <SponsorTips />
      </div>
    </section>
  );
}
