import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { pointsService } from '../../services/pointsService';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { SponsorRewardDefaults, PointValueHistoryEntry, ApiError } from '../../types';

export function SponsorRewardSettingsPage() {
  // Current defaults
  const [defaults, setDefaults] = useState<SponsorRewardDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Form state
  const [dollarPerPoint, setDollarPerPoint] = useState('');
  const [earnRate, setEarnRate] = useState('');
  const [expirationDays, setExpirationDays] = useState('');
  const [maxPerDay, setMaxPerDay] = useState('');
  const [maxPerMonth, setMaxPerMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // History
  const [history, setHistory] = useState<PointValueHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadDefaults = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await pointsService.getSponsorRewardDefaults();
      setDefaults(data);
      setDollarPerPoint(String(data.dollar_per_point));
      setEarnRate(String(data.earn_rate));
      setExpirationDays(data.expiration_days != null ? String(data.expiration_days) : '');
      setMaxPerDay(data.max_points_per_day != null ? String(data.max_points_per_day) : '');
      setMaxPerMonth(data.max_points_per_month != null ? String(data.max_points_per_month) : '');
    } catch (err) {
      const apiErr = err as ApiError;
      setLoadError(apiErr.message || 'Failed to load reward settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await pointsService.getPointValueHistory();
      setHistory(data.history);
    } catch {
      // History may be empty or table may not exist yet — not critical
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefaults();
    loadHistory();
  }, [loadDefaults, loadHistory]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const dpp = parseFloat(dollarPerPoint);
    if (isNaN(dpp) || dpp < 0) {
      setError('Dollar per point must be a non-negative number.');
      return;
    }

    const er = parseFloat(earnRate);
    if (isNaN(er) || er < 0) {
      setError('Earn rate must be a non-negative number.');
      return;
    }

    const expDays = expirationDays.trim() ? parseInt(expirationDays, 10) : null;
    if (expDays !== null && (isNaN(expDays) || expDays < 1)) {
      setError('Expiration days must be at least 1, or leave blank for no expiration.');
      return;
    }

    const mpd = maxPerDay.trim() ? parseInt(maxPerDay, 10) : null;
    if (mpd !== null && (isNaN(mpd) || mpd < 1)) {
      setError('Max points per day must be at least 1, or leave blank for unlimited.');
      return;
    }

    const mpm = maxPerMonth.trim() ? parseInt(maxPerMonth, 10) : null;
    if (mpm !== null && (isNaN(mpm) || mpm < 1)) {
      setError('Max points per month must be at least 1, or leave blank for unlimited.');
      return;
    }

    setSaving(true);
    try {
      await pointsService.updateSponsorRewardDefaults({
        dollar_per_point: dpp,
        earn_rate: er,
        expiration_days: expDays,
        max_points_per_day: mpd,
        max_points_per_month: mpm,
      });
      setSuccessMsg('Reward settings updated successfully.');
      // Refresh history in case dollar_per_point changed
      loadHistory();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to update reward settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner label="Loading reward settings..." />;
  }

  if (loadError) {
    return (
      <section className="card" aria-labelledby="reward-settings-heading">
        <h2 id="reward-settings-heading">Reward Settings</h2>
        <Alert variant="error">{loadError}</Alert>
        <div className="mt-2">
          <Button onClick={loadDefaults}>Retry</Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="reward-settings-heading">
      <h2 id="reward-settings-heading">Reward Settings</h2>
      <p className="mt-1">
        Configure how points are valued and earned for your drivers.
      </p>

      <div className="card mt-2">
        {successMsg && <Alert variant="success">{successMsg}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {defaults && (
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Current point value: <strong>${defaults.dollar_per_point.toFixed(2)}</strong> per point
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Dollar Per Point ($)"
            id="dollar-per-point"
            type="number"
            value={dollarPerPoint}
            onChange={(e) => setDollarPerPoint(e.target.value)}
            helperText="The dollar value of each point (e.g. 0.01 = 1 cent per point)."
            required
          />

          <FormField
            label="Earn Rate (multiplier)"
            id="earn-rate"
            type="number"
            value={earnRate}
            onChange={(e) => setEarnRate(e.target.value)}
            helperText="Point earning multiplier (1.0 = standard rate)."
            required
          />

          <FormField
            label="Expiration Days"
            id="expiration-days"
            type="number"
            value={expirationDays}
            onChange={(e) => setExpirationDays(e.target.value)}
            helperText="Days until points expire. Leave blank for no expiration."
          />

          <FormField
            label="Max Points Per Day"
            id="max-per-day"
            type="number"
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(e.target.value)}
            helperText="Daily point cap. Leave blank for unlimited."
          />

          <FormField
            label="Max Points Per Month"
            id="max-per-month"
            type="number"
            value={maxPerMonth}
            onChange={(e) => setMaxPerMonth(e.target.value)}
            helperText="Monthly point cap. Leave blank for unlimited."
          />

          <Button type="submit" loading={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </div>

      {/* Point Value Change History */}
      <h3 className="mt-2" style={{ marginTop: '2rem' }}>Point Value Change History</h3>
      {historyLoading ? (
        <Spinner label="Loading history..." />
      ) : history.length === 0 ? (
        <p className="placeholder-msg mt-1">
          No point value changes recorded yet.
        </p>
      ) : (
        <div className="card mt-1">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Date</th>
                <th style={{ padding: '0.5rem' }}>Old Value</th>
                <th style={{ padding: '0.5rem' }}>New Value</th>
                <th style={{ padding: '0.5rem' }}>Changed By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {new Date(entry.changed_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td style={{ padding: '0.5rem' }}>${entry.old_value.toFixed(4)}</td>
                  <td style={{ padding: '0.5rem' }}>${entry.new_value.toFixed(4)}</td>
                  <td style={{ padding: '0.5rem' }}>{entry.changed_by_username || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
