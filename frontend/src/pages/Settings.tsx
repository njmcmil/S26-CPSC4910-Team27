import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { authService } from '../services/authService';
import { trustedDevicesService } from '../services/trustedDevicesService';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { TrustedDevice, ApiError } from '../types';
import { api } from '../services/apiClient';

type Tab = 'devices' | 'notifications' | 'password';

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('devices');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'devices', label: 'Trusted Devices' },
    ...(user?.role === 'driver'
      ? [{ id: 'notifications' as const, label: 'Notifications' }]
      : []),
    { id: 'password', label: 'Change Password' },
  ];

  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading">Settings</h2>

      <div className="tabs mt-1" role="tablist" aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`tab-btn${activeTab === tab.id ? ' tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="tab-panel card"
      >
        {activeTab === 'devices' && <TrustedDevicesPanel />}
        {activeTab === 'notifications' && <NotificationsPanel />}
        {activeTab === 'password' && <ChangePasswordPanel />}
      </div>
    </section>
  );
}

/* ── Trusted Devices Panel ── */

function TrustedDevicesPanel() {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [revokingId, setRevokingId] = useState<number | null>(null);

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
    setRevokingId(device.device_id);
    try {
      await trustedDevicesService.revoke(device.device_id);
      setDevices((prev) => prev.filter((d) => d.device_id !== device.device_id));
      setSuccessMsg(`Device "${device.device_name}" has been removed.`);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to revoke device.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <>
      <h3>Trusted Devices</h3>

      <div aria-live="polite" aria-atomic="true">
        {successMsg && <Alert variant="success">{successMsg}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
      </div>

      {loading && <Spinner label="Loading trusted devices..." />}

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
              <th scope="col">Type</th>
              <th scope="col">Last Used</th>
              <th scope="col">Added</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.device_id}>
                <td>{d.device_name}</td>
                <td>{d.device_type}</td>
                <td>
                  {d.last_used
                    ? new Date(d.last_used).toLocaleString()
                    : '\u2014'}
                </td>
                <td>
                  {d.created_at
                    ? new Date(d.created_at).toLocaleString()
                    : '\u2014'}
                </td>
                <td>
                  <Button
                    variant="danger"
                    onClick={() => handleRevoke(d)}
                    loading={revokingId === d.device_id}
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
    </>
  );
}

/* ── Notifications Panel (Driver only) ── */

function NotificationsPanel() {
  const [pointsEmail, setPointsEmail] = useState(true);
  const [ordersEmail, setOrdersEmail] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ points_email_enabled: boolean; orders_email_enabled: boolean }>(
      '/api/driver/notification-preferences'
    )
      .then((data) => {
        setPointsEmail(data.points_email_enabled);
        setOrdersEmail(data.orders_email_enabled);
      })
      .catch(() => setError('Failed to load preferences.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await api.put('/api/driver/notification-preferences', {
        points_email_enabled: pointsEmail,
        orders_email_enabled: ordersEmail,
      });
      setSuccess('Preferences saved!');
    } catch {
      setError('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading preferences..." />;

  return (
    <>
      <h3>Alert Preferences</h3>
      <p className="helper-text mt-1">
        Choose which email notifications you'd like to receive.
        You will always receive an email if you are removed from a sponsor — this cannot be disabled.
      </p>

      <div aria-live="polite" aria-atomic="true">
        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
      </div>

      <div className="checkbox-group mt-2">
        <input
          type="checkbox"
          id="notif-points"
          checked={pointsEmail}
          onChange={(e) => setPointsEmail(e.target.checked)}
        />
        <div>
          <label htmlFor="notif-points">Points added or removed</label>
          <p className="helper-text">Get an email whenever your points balance changes.</p>
        </div>
      </div>

      <div className="checkbox-group mt-1">
        <input
          type="checkbox"
          id="notif-orders"
          checked={ordersEmail}
          onChange={(e) => setOrdersEmail(e.target.checked)}
        />
        <div>
          <label htmlFor="notif-orders">Order placed</label>
          <p className="helper-text">Get an email when an order is placed on your behalf.</p>
        </div>
      </div>

      <div className="mt-2">
        <Button onClick={handleSave} loading={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </>
  );
}

/* ── Change Password Panel ── */

function ChangePasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError(
        'Password must be at least 8 characters with uppercase, lowercase, digit, and special character.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h3>Change Password</h3>

      <div aria-live="polite" aria-atomic="true">
        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-1">
        <FormField
          label="Current Password"
          id="cp-current"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <FormField
          label="New Password"
          id="cp-new"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          helperText="Min 8 characters, uppercase, lowercase, digit, and special character."
        />
        <FormField
          label="Confirm New Password"
          id="cp-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" loading={submitting}>
          {submitting ? 'Changing...' : 'Change Password'}
        </Button>
      </form>
    </>
  );
}
