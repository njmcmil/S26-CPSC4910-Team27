import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { sponsorService } from '../../services/sponsorService';
import { pointsService } from '../../services/pointsService';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { ApiError, PointTransaction, SponsorPointHistoryResponse } from '../../types';

interface SponsorDriver {
  sponsor_driver_id: number;
  driver_user_id: number;
  username: string;
  email: string;
  points_balance: number;
  first_name: string | null;
  last_name: string | null;
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.65rem 0.8rem',
  borderBottom: '2px solid var(--color-border)',
  background: '#f8fafc',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  padding: '0.65rem 0.8rem',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top',
};

function formatDriverName(driver: SponsorDriver) {
  const fullName = `${driver.first_name ?? ''} ${driver.last_name ?? ''}`.trim();
  return fullName || driver.username;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function downloadCSV(filename: string, rows: Array<Record<string, string | number | null>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const text = String(value);
          return text.includes(',') || text.includes('"') || text.includes('\n')
            ? `"${text.replace(/"/g, '""')}"`
            : text;
        })
        .join(','),
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SponsorReportsPage() {
  const [drivers, setDrivers] = useState<SponsorDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState('');

  const defaultStart = toDateInputValue(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const defaultEnd = toDateInputValue(new Date());

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [report, setReport] = useState<SponsorPointHistoryResponse | null>(null);

  useEffect(() => {
    const loadDrivers = async () => {
      setDriversLoading(true);
      setDriversError('');
      try {
        const data = await sponsorService.getDrivers();
        setDrivers(data);
        if (data.length > 0) {
          setSelectedDriverId(String(data[0].driver_user_id));
        }
      } catch (err) {
        const apiErr = err as ApiError;
        setDriversError(apiErr.message || 'Failed to load drivers for reporting.');
      } finally {
        setDriversLoading(false);
      }
    };

    loadDrivers();
  }, []);

  const selectedDriver = useMemo(
    () => drivers.find((driver) => String(driver.driver_user_id) === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  );

  const totals = useMemo(() => {
    if (!report) {
      return {
        additions: 0,
        deductions: 0,
        netChange: 0,
        positiveCount: 0,
        negativeCount: 0,
      };
    }

    return report.history.reduce(
      (acc, row) => {
        if (row.points_changed >= 0) {
          acc.additions += row.points_changed;
          acc.positiveCount += 1;
        } else {
          acc.deductions += Math.abs(row.points_changed);
          acc.negativeCount += 1;
        }
        acc.netChange += row.points_changed;
        return acc;
      },
      { additions: 0, deductions: 0, netChange: 0, positiveCount: 0, negativeCount: 0 },
    );
  }, [report]);

  const recentBehavior = useMemo(() => {
    if (!report || report.history.length === 0) return null;

    const latest = report.history[0];
    const largestAward = report.history
      .filter((entry) => entry.points_changed > 0)
      .sort((a, b) => b.points_changed - a.points_changed)[0];
    const largestDeduction = report.history
      .filter((entry) => entry.points_changed < 0)
      .sort((a, b) => a.points_changed - b.points_changed)[0];

    const reasonCounts = new Map<string, number>();
    for (const entry of report.history) {
      const key = entry.reason?.trim() || 'No reason provided';
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }

    const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      latest,
      largestAward,
      largestDeduction,
      topReason,
    };
  }, [report]);

  const handleGenerate = async () => {
    if (!selectedDriverId) {
      setReportError('Select a driver to generate a report.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setReportError('Start date must be on or before end date.');
      return;
    }

    setReportLoading(true);
    setReportError('');

    try {
      const data = await pointsService.getSponsorDriverPointHistory(Number(selectedDriverId), {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 250,
        offset: 0,
      });
      setReport(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setReport(null);
      setReportError(apiErr.message || 'Failed to generate driver point report.');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (!driversLoading && selectedDriverId) {
      handleGenerate();
    }
    // Intentional: trigger when selected driver changes after initial driver load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driversLoading, selectedDriverId]);

  const handleExport = () => {
    if (!report || !selectedDriver) return;

    const rows = report.history.map((row) => ({
      driver: formatDriverName(selectedDriver),
      username: selectedDriver.username,
      date: formatDate(row.date),
      points_changed: row.points_changed,
      direction: row.points_changed >= 0 ? 'Added' : 'Deducted',
      reason: row.reason ?? '',
      expires_at: row.expires_at ? formatDate(row.expires_at) : '',
    }));

    const suffix = `${selectedDriver.username}_${startDate || 'all'}_${endDate || 'all'}`.replace(/\//g, '-');
    downloadCSV(`driver_point_report_${suffix}.csv`, rows);
  };

  if (driversLoading) {
    return <Spinner label="Loading reports..." />;
  }

  if (driversError) {
    return (
      <section className="card" aria-labelledby="reports-heading">
        <h2 id="reports-heading">Driver Point Reports</h2>
        <Alert variant="error">{driversError}</Alert>
      </section>
    );
  }

  const totalDriverPoints = drivers.reduce((sum, driver) => sum + (driver.points_balance || 0), 0);

  return (
    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading">Driver Point Reports</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Generate a driver-level points report to review balances, trends, and the reasons behind recent point changes.
      </p>

      <div className="card mt-2">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260, flex: '1 1 260px' }}>
            <label htmlFor="report-driver" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Driver
            </label>
            <select
              id="report-driver"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              style={{ padding: '0.55rem 0.7rem', borderRadius: 8, border: '1px solid var(--color-border)' }}
            >
              {drivers.map((driver) => (
                <option key={driver.driver_user_id} value={driver.driver_user_id}>
                  {formatDriverName(driver)} ({driver.username})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="report-start" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Start Date
            </label>
            <input
              id="report-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '0.55rem 0.7rem', borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="report-end" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              End Date
            </label>
            <input
              id="report-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '0.55rem 0.7rem', borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Button onClick={handleGenerate} disabled={reportLoading}>
              {reportLoading ? 'Generating...' : 'Generate Report'}
            </Button>
            <Button variant="secondary" onClick={handleExport} disabled={!report || report.history.length === 0}>
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {reportError && (
        <div className="mt-2">
          <Alert variant="error">{reportError}</Alert>
        </div>
      )}

      <div className="metrics-grid mt-2">
        <div className="metric-card">
          <span className="metric-card-label">Enrolled Drivers</span>
          <span className="metric-card-value">{drivers.length}</span>
          <span className="metric-card-sub">available for reports</span>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Total Driver Points</span>
          <span className="metric-card-value">{totalDriverPoints.toLocaleString()}</span>
          <span className="metric-card-sub">current sponsor-wide balance</span>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Selected Driver Balance</span>
          <span className="metric-card-value">{selectedDriver?.points_balance.toLocaleString() ?? '0'}</span>
          <span className="metric-card-sub">current live balance</span>
        </div>
        <div className="metric-card">
          <span className="metric-card-label">Transactions In Range</span>
          <span className="metric-card-value">{report?.total_count ?? 0}</span>
          <span className="metric-card-sub">matching report filters</span>
        </div>
      </div>

      {reportLoading ? (
        <div className="mt-2">
          <Spinner label="Generating driver report..." />
        </div>
      ) : report ? (
        <>
          <div className="card mt-2">
            <h3 style={{ marginBottom: '0.75rem' }}>Report Summary</h3>
            <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: '0.9rem 1rem' }}>
                <div style={{ color: '#1d4ed8', fontSize: '0.8rem', fontWeight: 700 }}>Current Points</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.35rem' }}>
                  {report.current_points.toLocaleString()}
                </div>
              </div>
              <div style={{ background: '#ecfdf5', borderRadius: 10, padding: '0.9rem 1rem' }}>
                <div style={{ color: '#047857', fontSize: '0.8rem', fontWeight: 700 }}>Points Added</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.35rem' }}>
                  +{totals.additions.toLocaleString()}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  {totals.positiveCount} positive adjustments
                </div>
              </div>
              <div style={{ background: '#fef2f2', borderRadius: 10, padding: '0.9rem 1rem' }}>
                <div style={{ color: '#b91c1c', fontSize: '0.8rem', fontWeight: 700 }}>Points Deducted</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.35rem' }}>
                  -{totals.deductions.toLocaleString()}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  {totals.negativeCount} negative adjustments
                </div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.9rem 1rem' }}>
                <div style={{ color: '#334155', fontSize: '0.8rem', fontWeight: 700 }}>Net Change</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.35rem' }}>
                  {totals.netChange >= 0 ? '+' : ''}
                  {totals.netChange.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="card mt-2">
            <h3 style={{ marginBottom: '0.75rem' }}>Behavior Snapshot</h3>
            {recentBehavior ? (
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Latest Activity</div>
                  <div style={{ fontSize: '0.92rem' }}>
                    {recentBehavior.latest.points_changed >= 0 ? '+' : ''}
                    {recentBehavior.latest.points_changed} points on {formatDate(recentBehavior.latest.date)}
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                    {recentBehavior.latest.reason || 'No reason provided'}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Largest Award</div>
                  <div style={{ fontSize: '0.92rem' }}>
                    {recentBehavior.largestAward
                      ? `+${recentBehavior.largestAward.points_changed} points`
                      : 'No awards in this range'}
                  </div>
                  {recentBehavior.largestAward && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                      {recentBehavior.largestAward.reason || 'No reason provided'}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Largest Deduction</div>
                  <div style={{ fontSize: '0.92rem' }}>
                    {recentBehavior.largestDeduction
                      ? `${recentBehavior.largestDeduction.points_changed} points`
                      : 'No deductions in this range'}
                  </div>
                  {recentBehavior.largestDeduction && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                      {recentBehavior.largestDeduction.reason || 'No reason provided'}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Most Common Reason</div>
                  <div style={{ fontSize: '0.92rem' }}>
                    {recentBehavior.topReason ? recentBehavior.topReason[0] : 'No reasons available'}
                  </div>
                  {recentBehavior.topReason && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                      Used {recentBehavior.topReason[1]} time{recentBehavior.topReason[1] === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="placeholder-msg">No point activity matched the selected range.</p>
            )}
          </div>

          <div className="card mt-2" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <h3 style={{ marginBottom: '0.35rem' }}>Transaction Details</h3>
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                Use the table below to inspect exactly when points changed and why.
              </p>
            </div>

            {report.history.length === 0 ? (
              <p className="placeholder-msg" style={{ padding: '1rem' }}>
                No point changes were recorded for this driver in the selected date range.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Change</th>
                      <th style={th}>Direction</th>
                      <th style={th}>Reason</th>
                      <th style={th}>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.history.map((row: PointTransaction, index) => (
                      <tr key={`${row.date}-${index}`}>
                        <td style={td}>{formatDate(row.date)}</td>
                        <td
                          style={{
                            ...td,
                            fontWeight: 700,
                            color: row.points_changed >= 0 ? '#047857' : '#b91c1c',
                          }}
                        >
                          {row.points_changed >= 0 ? '+' : ''}
                          {row.points_changed.toLocaleString()}
                        </td>
                        <td style={td}>{row.points_changed >= 0 ? 'Added' : 'Deducted'}</td>
                        <td style={td}>{row.reason || 'No reason provided'}</td>
                        <td style={td}>{row.expires_at ? formatDate(row.expires_at) : 'Does not expire'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
