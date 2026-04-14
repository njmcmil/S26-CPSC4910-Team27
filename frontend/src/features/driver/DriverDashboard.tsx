import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { driverService } from '../../services/driverService';
import { api } from '../../services/apiClient';
import { Spinner } from '../../components/Spinner';
import DriverTips from '../../components/DriverTips';
import type { ApiError, DriverProfile } from '../../types';
import type { DriverApplicationSponsor } from '../../services/driverService';

const KEYBOARD_MODE_STORAGE_KEY = 'gdip_keyboard_mode';

interface DriverOrder {
  order_id: number;
  item_id: string;
  item_title: string;
  points_cost: number;
  status: 'pending' | 'shipped' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface DashboardActivity {
  date: string;
  points_changed: number;
  reason: string | null;
}

export function DriverDashboardPage() {
  const { user, activeSponsorId, sponsors: authSponsors } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [sponsors, setSponsors] = useState<DriverApplicationSponsor[]>([]);
  const [recentActivity, setRecentActivity] = useState<DashboardActivity[]>([]);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyboardMode, setKeyboardMode] = useState(false);

  useEffect(() => {
    const syncKeyboardMode = () => {
      setKeyboardMode(localStorage.getItem(KEYBOARD_MODE_STORAGE_KEY) === 'true');
    };

    syncKeyboardMode();
    window.addEventListener('storage', syncKeyboardMode);
    window.addEventListener('gdip-keyboard-mode-changed', syncKeyboardMode);

    return () => {
      window.removeEventListener('storage', syncKeyboardMode);
      window.removeEventListener('gdip-keyboard-mode-changed', syncKeyboardMode);
    };
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const [profileRes, pointsRes, ordersRes, sponsorsRes] = await Promise.allSettled([
          driverService.getProfile(),
          driverService.getPoints(activeSponsorId ?? undefined),
          api.get<{ orders: DriverOrder[] }>('/api/driver/orders'),
          driverService.getApplicationSponsors(),
        ]);

        const profileData = profileRes.status === 'fulfilled' ? profileRes.value : null;
        const pointsData = pointsRes.status === 'fulfilled'
          ? pointsRes.value
          : { current_points: 0, history: [], total_count: 0, driver_id: 0 };
        const orderData = ordersRes.status === 'fulfilled' ? ordersRes.value : { orders: [] };
        const sponsorData = sponsorsRes.status === 'fulfilled' ? sponsorsRes.value : [];

        if (
          profileRes.status === 'rejected' &&
          pointsRes.status === 'rejected' &&
          ordersRes.status === 'rejected' &&
          sponsorsRes.status === 'rejected'
        ) {
          throw new Error('Failed to load driver dashboard.');
        }

        setProfile(profileData);
        setSponsors(sponsorData);
        setRecentActivity(
          pointsData.history.slice(0, 5).map((entry) => ({
            date: entry.date,
            points_changed: entry.points_changed,
            reason: entry.reason ?? null,
          })),
        );
        setOrders(orderData.orders.slice(0, 3));
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr.message || 'Failed to load driver dashboard.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [activeSponsorId]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === 'pending').length,
    [orders],
  );

  const activeSponsor = authSponsors.find(s => s.sponsor_user_id === activeSponsorId);
  const currentSponsor = sponsors.find((sponsor) => sponsor.is_current_sponsor) ?? null;
  const sponsorHeadline = activeSponsor?.sponsor_name ?? currentSponsor?.sponsor_name ?? 'Not assigned';
  const sponsorPointsBalance = activeSponsor?.total_points ?? profile?.points_balance ?? 0;
  const sponsorLabel = activeSponsor
    ? `${activeSponsor.total_points.toLocaleString() ?? '0'} points available`
    : currentSponsor
    ? 'You currently have an active sponsor connection.'
    : 'No sponsor is assigned yet. Apply to a sponsor to join a rewards program.';

  if (loading) {
    return <Spinner label="Loading dashboard..." />;
  }

  if (error) {
    return (
      <section aria-labelledby="driver-dash-heading">
        <h2 id="driver-dash-heading">Driver Dashboard</h2>
        <div className="card mt-2">
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="driver-dash-heading">
      <h2 id="driver-dash-heading">Driver Dashboard</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Welcome back, {user?.username}. Here is a quick look at your rewards activity.
      </p>

      {keyboardMode && (
        <div className="card mt-2">
          <h3>Overview Shortcuts</h3>
          <p className="helper-text" style={{ marginBottom: '0.75rem' }}>
            Tab through these primary actions first, then press Enter to open the highlighted one.
          </p>
          <div className="dashboard-action-list">
            <Link to="/driver/catalog" className="dashboard-action-card">
              <strong>Browse Catalog</strong>
              <span>Redeem your points for sponsor rewards.</span>
            </Link>
            <Link to="/driver/points" className="dashboard-action-card">
              <strong>View Point History</strong>
              <span>See every award and deduction in your account.</span>
            </Link>
            <Link to="/driver/orders" className="dashboard-action-card">
              <strong>Manage Orders</strong>
              <span>Track pending redemptions and cancel when needed.</span>
            </Link>
            <Link to="/driver/profile" className="dashboard-action-card">
              <strong>Edit Profile</strong>
              <span>Update your personal details, license, and vehicle information.</span>
            </Link>
          </div>
        </div>
      )}

      <div className="dashboard-tabbar">
        <Link to="/driver/points" className="dashboard-tablink">Points</Link>
        <Link to="/driver/catalog" className="dashboard-tablink">Catalog</Link>
        <Link to="/driver/orders" className="dashboard-tablink">My Orders</Link>
        <Link to="/driver/applications" className="dashboard-tablink">Applications</Link>
        <Link to="/driver/profile" className="dashboard-tablink">Edit Profile</Link>
      </div>

      <div className="metrics-grid mt-2">
        <div className="metric-card">
          <span className="metric-card-label">Points Balance</span>
          <span className="metric-card-value">{sponsorPointsBalance.toLocaleString()}</span>
          <span className="metric-card-sub">available to redeem</span>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Pending Orders</span>
          <span className="metric-card-value">{pendingOrders}</span>
          <span className="metric-card-sub">currently being processed</span>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Recent Activity</span>
          <span className="metric-card-value">{recentActivity.length}</span>
          <span className="metric-card-sub">latest point changes shown below</span>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Current Sponsor</span>
          <span className="metric-card-value" style={{ fontSize: '1.3rem' }}>
            {sponsorHeadline}
          </span>
          <span className="metric-card-sub">{sponsorLabel}</span>
        </div>
      </div>

      <div className="dashboard-overview-grid mt-2">
        <div className="card">
          <h3>Recent Point Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="placeholder-msg">No recent point activity yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentActivity.map((entry, index) => (
                <div key={`${entry.date}-${index}`} className="dashboard-list-row">
                  <div>
                    <div className="dashboard-list-title">{entry.reason || 'Point adjustment'}</div>
                    <div className="dashboard-list-sub">
                      {new Date(entry.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={entry.points_changed >= 0 ? 'points-positive' : 'points-negative'}>
                    {entry.points_changed >= 0 ? '+' : ''}
                    {entry.points_changed}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {keyboardMode && (
          <div className="card">
            <h3>Keyboard Help</h3>
            <p className="helper-text">
              Enter activates the currently focused button or link, just like clicking it with the mouse.
            </p>
          </div>
        )}
      </div>

      <div className="dashboard-overview-grid mt-2">
        <div className="card">
          <h3>Latest Orders</h3>
          {orders.length === 0 ? (
            <p className="placeholder-msg">No orders yet. Your next redemption will show up here.</p>
          ) : (
            <div className="dashboard-list">
              {orders.map((order) => (
                <div key={order.order_id} className="dashboard-list-row">
                  <div>
                    <div className="dashboard-list-title">{order.item_title}</div>
                    <div className="dashboard-list-sub">
                      {new Date(order.created_at).toLocaleDateString()} • {order.points_cost.toLocaleString()} pts
                    </div>
                  </div>
                  <span className={`status-pill status-${order.status}`}>{order.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Driving Tips</h3>
          <p className="helper-text" style={{ marginBottom: '0.75rem' }}>
            Stay up to date with sponsor-provided safe driving guidance.
          </p>
          <DriverTips />
        </div>
      </div>
    </section>
  );
}
