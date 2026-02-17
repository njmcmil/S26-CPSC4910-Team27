import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/apiClient';
import { pointsService } from '../../services/pointsService';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
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

type AdjustmentType = 'add' | 'deduct';

export function SponsorPointsPage() {
  // Driver list
  const [drivers, setDrivers] = useState<SponsorDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState('');

  // Form state
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Point history toggle
  const [showHistory, setShowHistory] = useState(false);

  const fetchDrivers = useCallback(async () => {
    setDriversLoading(true);
    setDriversError('');
    try {
      const data = await api.get<SponsorDriver[]>('/sponsor/drivers');
      setDrivers(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setDriversError(apiErr.message || 'Failed to load drivers.');
    } finally {
      setDriversLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const driverDisplayName = (d: SponsorDriver) =>
    d.first_name || d.last_name
      ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim()
      : d.username;

  const selectedDriver = drivers.find(
    (d) => d.driver_user_id === Number(selectedDriverId),
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedDriverId) {
      setError('Please select a driver.');
      return;
    }

    const pointsNum = parseInt(points, 10);
    if (!points || isNaN(pointsNum) || pointsNum <= 0) {
      setError('Points must be a positive number.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide a reason (at least 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        driver_id: Number(selectedDriverId),
        points: pointsNum,
        reason: reason.trim(),
      };

      const res =
        adjustmentType === 'add'
          ? await pointsService.addPoints(payload)
          : await pointsService.deductPoints(payload);

      setSuccessMsg(res.message);
      setPoints('');
      setReason('');

      // Update the local driver's balance so the UI reflects the change
      setDrivers((prev) =>
        prev.map((d) =>
          d.driver_user_id === Number(selectedDriverId)
            ? { ...d, points_balance: res.new_total }
            : d,
        ),
      );
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to submit point adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (driversLoading) {
    return <Spinner label="Loading drivers..." />;
  }

  if (driversError) {
    return (
      <section className="card" aria-labelledby="points-heading">
        <h2 id="points-heading">Manage Points</h2>
        <Alert variant="error">{driversError}</Alert>
        <div className="mt-2">
          <Button onClick={fetchDrivers}>Retry</Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="points-heading">
      <h2 id="points-heading">Manage Points</h2>
      <p className="mt-1">
        Add or deduct points for drivers with a reason for each adjustment.
      </p>

      {drivers.length === 0 ? (
        <p className="placeholder-msg mt-2">
          No drivers enrolled yet. Approve driver applications first.
        </p>
      ) : (
        <div className="card mt-2">
          {successMsg && <Alert variant="success">{successMsg}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
            {/* Driver selector */}
            <div className="form-group">
              <label htmlFor="points-driver">Driver</label>
              <select
                id="points-driver"
                value={selectedDriverId}
                onChange={(e) => {
                  setSelectedDriverId(e.target.value);
                  setSuccessMsg('');
                  setError('');
                  setShowHistory(false);
                }}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
              >
                <option value="">-- Select a driver --</option>
                {drivers.map((d) => (
                  <option key={d.driver_user_id} value={d.driver_user_id}>
                    {driverDisplayName(d)} ({d.username}) —{' '}
                    {d.points_balance.toLocaleString()} pts
                  </option>
                ))}
              </select>
            </div>

            {/* Action type */}
            <div className="form-group">
              <label htmlFor="points-action">Action</label>
              <select
                id="points-action"
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
              >
                <option value="add">Add Points</option>
                <option value="deduct">Deduct Points</option>
              </select>
            </div>

            <FormField
              label="Points"
              id="points-amount"
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              helperText="Enter a positive number."
              required
            />

            <FormField
              label="Reason"
              id="points-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              helperText="Required: explain why this adjustment is being made (3-255 chars)."
              required
            />

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button type="submit" loading={submitting} disabled={!selectedDriverId}>
                {submitting
                  ? 'Submitting...'
                  : adjustmentType === 'add'
                    ? 'Add Points'
                    : 'Deduct Points'}
              </Button>

              {selectedDriver && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? 'Hide History' : 'View Point History'}
                </Button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Inline point history for the selected driver */}
      {showHistory && selectedDriver && (
        <DriverPointHistory
          driverId={selectedDriver.driver_user_id}
          driverName={driverDisplayName(selectedDriver)}
          onClose={() => setShowHistory(false)}
        />
      )}
    </section>
  );
}
