import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { fetchSystemMetrics, type SystemMetrics } from '../../services/AdminService'

const POLL_INTERVAL_MS = 30_000;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface MetricCardProps {
  label: string;
  value: number | string;
  sub?: string;
  highlight?: 'warning' | 'danger';
}

function MetricCard({ label, value, sub, highlight }: MetricCardProps) {
  const accentStyle: React.CSSProperties =
    highlight === 'danger'
      ? { borderTop: '3px solid var(--color-danger)' }
      : highlight === 'warning'
      ? { borderTop: '3px solid var(--color-warning)' }
      : { borderTop: '3px solid var(--color-primary)' };

  return (
    <div className="card" style={accentStyle}>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: 'var(--color-text)' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadMetrics() {
    try {
      const data = await fetchSystemMetrics();
      setMetrics(data);
      setLastUpdated(new Date().toISOString());
      setError(null);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to load metrics';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
    intervalRef.current = setInterval(loadMetrics, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <section aria-labelledby="admin-heading">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 id="admin-heading">Admin Dashboard</h2>
          <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Welcome back, {user?.username}.
          </p>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
          {loading && !metrics && <span>Loading metrics…</span>}
          {lastUpdated && !loading && (
            <span>Last updated: {formatTimestamp(lastUpdated)}</span>
          )}
          {loading && metrics && <span style={{ marginLeft: '0.5rem' }}>Refreshing…</span>}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius)',
            color: 'var(--color-danger)',
            fontSize: '0.875rem',
          }}
        >
          {error} — metrics will retry automatically.
        </div>
      )}

      {loading && !metrics ? (
        <p style={{ marginTop: '2rem', color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : metrics ? (
        <>
          {/* Users */}
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
            Users
          </h3>
          <div className="placeholder-grid">
            <MetricCard label="Total Users" value={metrics.total_users} />
            <MetricCard label="Drivers" value={metrics.total_drivers} />
            <MetricCard label="Sponsors" value={metrics.total_sponsors} />
            <MetricCard label="Admins" value={metrics.total_admins} />
          </div>

          {/* Orders */}
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
            Orders (all time)
          </h3>
          <div className="placeholder-grid">
            <MetricCard label="Total Orders" value={metrics.total_orders} />
            <MetricCard
              label="Pending"
              value={metrics.pending_orders}
              highlight={metrics.pending_orders > 0 ? 'warning' : undefined}
            />
            <MetricCard label="Shipped" value={metrics.shipped_orders} />
            <MetricCard
              label="Cancelled"
              value={metrics.cancelled_orders}
              highlight={metrics.cancelled_orders > 0 ? 'danger' : undefined}
            />
          </div>

          {/* Points */}
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
            Points (all time)
          </h3>
          <div className="placeholder-grid">
            <MetricCard label="Points Awarded" value={metrics.total_points_awarded.toLocaleString()} />
            <MetricCard label="Points Redeemed" value={metrics.total_points_redeemed.toLocaleString()} />
          </div>

          {/* Logins */}
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
            Logins (last 24 hours)
          </h3>
          <div className="placeholder-grid">
            <MetricCard label="Login Attempts" value={metrics.logins_last_24h} />
            <MetricCard
              label="Failed Logins"
              value={metrics.failed_logins_last_24h}
              sub={metrics.logins_last_24h > 0 ? `${Math.round((metrics.failed_logins_last_24h / metrics.logins_last_24h) * 100)}% failure rate` : undefined}
              highlight={metrics.failed_logins_last_24h > 0 ? 'danger' : undefined}
            />
          </div>

          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Metrics auto-refresh every 30 seconds.
          </p>
        </>
      ) : null}
    </section>
  );
}
