import { useCallback, useEffect, useState } from 'react';
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
  first_name: string | null;
  last_name: string | null;
}

export function SponsorDriversPage() {
  const [drivers, setDrivers] = useState<SponsorDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<SponsorDriver | null>(null);

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

  return (
    <section aria-labelledby="drivers-heading">
      <h2 id="drivers-heading">Drivers</h2>
      <p className="mt-1">View and manage drivers enrolled in your program.</p>

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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
