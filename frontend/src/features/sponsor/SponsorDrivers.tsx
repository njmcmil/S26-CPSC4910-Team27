import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api } from '../../services/apiClient';
import { Spinner } from '../../components/Spinner';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DriverPointHistory } from './DriverPointHistory';
import type { ApiError } from '../../types';

interface SponsorDriver {
  sponsor_driver_id: number;
  driver_user_id: number;
  username: string;
  email: string;
  points_balance: number;
  account_status: string;
  first_name: string | null;
  last_name: string | null;
}

const STATUS_COLORS: Record<string, CSSProperties> = {
  active: { background: '#dcfce7', color: '#166534' },
  inactive: { background: '#fef9c3', color: '#854d0e' },
  banned: { background: '#fee2e2', color: '#991b1b' },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { background: '#f3f4f6', color: '#374151' };
  return (
    <span
      style={{
        ...colors,
        display: 'inline-block',
        padding: '0.15rem 0.55rem',
        borderRadius: '9999px',
        fontSize: '0.8rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

export function SponsorDriversPage() {
  const [drivers, setDrivers] = useState<SponsorDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<SponsorDriver | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [droppingDriver, setDroppingDriver] = useState<SponsorDriver | null>(null);
  const [dropReason, setDropReason] = useState('');
  const [dropLoading, setDropLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<SponsorDriver[]>('/sponsor/drivers');
      setDrivers(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load drivers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  if (loading) {
    return <Spinner label="Loading drivers..." />;
  }

  if (error) {
    return (
      <section className="card" aria-labelledby="drivers-heading">
        <h2 id="drivers-heading">Drivers</h2>
        <Alert variant="error">{error}</Alert>
        <div className="mt-2">
          <Button onClick={fetchDrivers}>Retry</Button>
        </div>
      </section>
    );
  }

  const driverDisplayName = (d: SponsorDriver) =>
    d.first_name || d.last_name
      ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim()
      : d.username;

  async function changeDriverStatus(driver: SponsorDriver, newStatus: 'active' | 'inactive' | 'banned') {
    setActionLoading(driver.driver_user_id);
    setError('');
    try {
      await api.post(`/sponsor/drivers/${driver.driver_user_id}/status`, { new_status: newStatus });
      await fetchDrivers();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to update driver status.');
    } finally {
      setActionLoading(null);
    }
  }

  async function dropDriver(driver: SponsorDriver) {
    if (!dropReason.trim()) return;
    setDropLoading(true);
    setError('');
    try {
      await api.post(`/sponsor/drivers/${driver.driver_user_id}/drop`, { reason: dropReason });
      setFeedback({ type: 'success', msg: `${driverDisplayName(driver)} has been dropped from your program.` });
      setDroppingDriver(null);
      setDropReason('');
      await fetchDrivers();
    } catch (err) {
      const apiErr = err as ApiError;
      setFeedback({ type: 'error', msg: apiErr.message || 'Failed to drop driver.' });
    } finally {
      setDropLoading(false);
    }
  }

  return (
    <section aria-labelledby="drivers-heading">
      <h2 id="drivers-heading">Drivers</h2>
      <p className="mt-1">View and manage drivers enrolled in your program.</p>

      {feedback && (
        <div role="alert" style={{
          padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: feedback.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 500,
        }}>
          {feedback.msg}
        </div>
      )}
      {drivers.length === 0 ? (
        <p className="placeholder-msg mt-2">
          No drivers enrolled yet.
        </p>
      ) : (
        <div className="card mt-2">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color, #ddd)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>Username</th>
                <th style={{ padding: '0.5rem' }}>Points</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr
                  key={driver.sponsor_driver_id}
                  style={{ borderBottom: '1px solid var(--border-color, #eee)' }}
                >
                  <td style={{ padding: '0.5rem' }}>{driverDisplayName(driver)}</td>
                  <td style={{ padding: '0.5rem' }}>{driver.username}</td>
                  <td style={{ padding: '0.5rem' }}>{driver.points_balance.toLocaleString()}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <StatusBadge status={driver.account_status} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Button
                        onClick={() =>
                          setSelectedDriver(
                            selectedDriver?.driver_user_id === driver.driver_user_id
                              ? null
                              : driver,
                          )
                        }
                      >
                        {selectedDriver?.driver_user_id === driver.driver_user_id
                          ? 'Hide History'
                          : 'Point History'}
                      </Button>
                      {driver.account_status === 'active' && (
                        <>
                          <Button
                            variant="secondary"
                            loading={actionLoading === driver.driver_user_id}
                            onClick={() => changeDriverStatus(driver, 'inactive')}
                          >
                            Deactivate
                          </Button>
                          <Button
                            variant="danger"
                            loading={actionLoading === driver.driver_user_id}
                            onClick={() => changeDriverStatus(driver, 'banned')}
                          >
                            Ban
                          </Button>
                        </>
                      )}
                      {driver.account_status === 'inactive' && (
                        <>
                          <Button
                            loading={actionLoading === driver.driver_user_id}
                            onClick={() => changeDriverStatus(driver, 'active')}
                          >
                            Reactivate
                          </Button>
                          <Button
                            variant="danger"
                            loading={actionLoading === driver.driver_user_id}
                            onClick={() => changeDriverStatus(driver, 'banned')}
                          >
                            Ban
                          </Button>
                        </>
                      )}
                      {driver.account_status === 'banned' && (
                        <Button
                          loading={actionLoading === driver.driver_user_id}
                          onClick={() => changeDriverStatus(driver, 'active')}
                        >
                          Unban
                        </Button>
                      )}
                    <Button
                        variant="danger"
                        loading={actionLoading === driver.driver_user_id}
                        onClick={() => { setDroppingDriver(driver); setDropReason(''); }}
                      >
                        Drop
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {droppingDriver && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 12, padding: '1.5rem',
            width: '100%', maxWidth: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Drop Driver</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              You are about to remove <strong>{driverDisplayName(droppingDriver)}</strong> from your program. They will receive an email notification. Please provide a reason.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Reason (required)
              </label>
              <textarea
                value={dropReason}
                onChange={e => setDropReason(e.target.value)}
                placeholder="Please provide a reason for dropping this driver..."
                rows={3}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button"
                onClick={() => { setDroppingDriver(null); setDropReason(''); }}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => dropDriver(droppingDriver)}
                disabled={!dropReason.trim() || dropLoading}
                style={{
                  padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
                  background: !dropReason.trim() ? '#9ca3af' : 'var(--color-danger)',
                  color: '#fff', fontWeight: 700,
                  cursor: !dropReason.trim() ? 'not-allowed' : 'pointer',
                }}>
                {dropLoading ? 'Dropping...' : 'Drop Driver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point History Panel (#14013) */}
      {selectedDriver && (
        <DriverPointHistory
          driverId={selectedDriver.driver_user_id}
          driverName={driverDisplayName(selectedDriver)}
          onClose={() => setSelectedDriver(null)}
        />
      )}
    </section>
  );
}
