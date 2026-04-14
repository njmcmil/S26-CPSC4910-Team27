import { useCallback, useEffect, useState } from 'react';
import { pointsService } from '../../services/pointsService';
import { Spinner } from '../../components/Spinner';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import type { ApiError, PointTransaction } from '../../types';

interface Props {
  driverId: number;
  driverName: string;
  onClose: () => void;
}

/**
 * point history timeline for a specific driver, shown in the sponsor dashboard.
 * supports start/end date filters.
 */
export function DriverPointHistory({ driverId, driverName, onClose }: Props) {
  const [history, setHistory] = useState<PointTransaction[]>([]);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // date filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await pointsService.getSponsorDriverPointHistory(driverId, {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setHistory(data.history);
      setCurrentPoints(data.current_points);
      setTotalCount(data.total_count);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load point history.');
    } finally {
      setLoading(false);
    }
  }, [driverId, startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="card mt-2">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Point History — {driverName}</h3>
        <Button onClick={onClose}>Close</Button>
      </div>

      <p className="mt-1">
        Current balance: <strong>{currentPoints.toLocaleString()}</strong> points
        {totalCount > 0 && <span className="text-muted"> ({totalCount} transactions)</span>}
      </p>

      {/* date filters */}
      <div className="mt-1" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="ph-start-date">Start Date</label>
          <input
            id="ph-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="ph-end-date">End Date</label>
          <input
            id="ph-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            setStartDate('');
            setEndDate('');
          }}
        >
          Clear Filters
        </Button>
      </div>

      {loading && <Spinner label="Loading history..." />}

      {error && (
        <div className="mt-1">
          <Alert variant="error">{error}</Alert>
          <div className="mt-1">
            <Button onClick={fetchHistory}>Retry</Button>
          </div>
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <p className="mt-1 text-muted">No point transactions found for the selected period.</p>
      )}

      {!loading && !error && history.length > 0 && (
        <div className="mt-1">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color, #ddd)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Date</th>
                <th style={{ padding: '0.5rem' }}>Points</th>
                <th style={{ padding: '0.5rem' }}>Reason</th>
                <th style={{ padding: '0.5rem' }}>Expires</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, idx) => {
                const date = new Date(entry.date);
                const isPositive = entry.points_changed > 0;
                return (
                  <tr
                    key={idx}
                    style={{ borderBottom: '1px solid var(--border-color, #eee)' }}
                  >
                    <td style={{ padding: '0.5rem' }}>
                      {date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      <span className="text-muted" style={{ fontSize: '0.85em' }}>
                        {date.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '0.5rem',
                        fontWeight: 'bold',
                        color: isPositive ? '#27ae60' : '#e74c3c',
                      }}
                    >
                      {isPositive ? '+' : ''}
                      {entry.points_changed.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{entry.reason || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {entry.expires_at ? (
                        <span
                          style={{
                            color:
                              new Date(entry.expires_at).getTime() - Date.now() <
                              7 * 24 * 60 * 60 * 1000
                                ? '#e74c3c'
                                : '#e67e22',
                          }}
                        >
                          {new Date(entry.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-muted">No expiration</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
