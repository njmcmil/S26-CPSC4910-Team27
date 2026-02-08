import { useCallback, useEffect, useState } from 'react';
import { trustedDevicesService } from '../services/trustedDevicesService';
import { Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import type { TrustedDevice, ApiError } from '../types';

export function AccountSettingsPage() {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await trustedDevicesService.list();
      setDevices(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load trusted devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRevoke = async (device: TrustedDevice) => {
    setSuccessMsg('');
    setError('');
    setRevokingId(device.id);
    try {
      await trustedDevicesService.revoke(device.id);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      setSuccessMsg(`Device "${device.device_name}" has been removed.`);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to revoke device.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="card" aria-labelledby="settings-heading">
      <h2 id="settings-heading">Account Settings</h2>
      <h3>Trusted Devices</h3>

      {/* Live region for status messages */}
      <div aria-live="polite" aria-atomic="true">
        {successMsg && <Alert variant="success">{successMsg}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
      </div>

      {loading && <Spinner label="Loading trusted devices…" />}

      {!loading && !error && devices.length === 0 && (
        <p className="mt-1">
          No trusted devices found. When you log in with "Remember this device"
          checked, the device will appear here.
        </p>
      )}

      {!loading && devices.length > 0 && (
        <table className="devices-table mt-1" aria-label="Trusted devices">
          <thead>
            <tr>
              <th scope="col">Device</th>
              <th scope="col">Last Used</th>
              <th scope="col">Added</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td>{d.device_name}</td>
                <td>{d.last_used ? new Date(d.last_used).toLocaleString() : '—'}</td>
                <td>{d.created_at ? new Date(d.created_at).toLocaleString() : '—'}</td>
                <td>
                  <Button
                    variant="danger"
                    onClick={() => handleRevoke(d)}
                    loading={revokingId === d.id}
                    aria-label={`Remove device ${d.device_name}`}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && error && (
        <div className="mt-2">
          <Button onClick={fetchDevices}>Retry</Button>
        </div>
      )}
    </section>
  );
}
