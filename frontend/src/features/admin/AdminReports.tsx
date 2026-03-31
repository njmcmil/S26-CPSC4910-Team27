import { useState } from 'react';
import { api } from '../../services/apiClient';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { ApiError } from '../../types';

// Redemption report
interface RedemptionReportRow {
  sponsor_id: number;
  sponsor_name: string;
  item_id: string;
  item_title: string;
  current_stock: number;
  total_redemptions: number;
  pending_redemptions: number;
  shipped_redemptions: number;
  cancelled_redemptions: number;
  total_points_redeemed: number;
  last_redeemed_at: string | null;
}

interface RedemptionReportResponse {
  generated_at: string;
  report_rows: RedemptionReportRow[];
}

// Operations Summary Report

interface OperationsSummary {
  period: string;
  date_from: string;
  date_to: string;
  generated_at: string;
  total_orders: number;
  pending_orders: number;
  shipped_orders: number;
  cancelled_orders: number;
  points_redeemed_via_orders: number;
  active_drivers: number;
  active_sponsors: number;
  new_drivers: number;
  new_sponsors: number;
  points_awarded: number;
  total_logins: number;
  failed_logins: number;
}

type View = 'redemption' | 'summary';
type Period = 'weekly' | 'monthly';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns ISO date string for the Monday of the week containing `date`. */
function weekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Returns ISO date string for the Sunday ending the week starting on `monday`. */
function weekEnd(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-01 for any date in that month. */
function monthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Returns the last day of the month for any date in that month. */
function monthEnd(date: Date): string {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

/** Download a plain-text CSV file in the browser. */
function downloadCsv(filename: string, rows: [string, string | number][]) {
  const lines = [
    'Metric,Value',
    ...rows.map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function summaryToCsvRows(s: OperationsSummary): [string, string | number][] {
  return [
    ['Period', s.period === 'weekly' ? 'Weekly' : 'Monthly'],
    ['Date From', s.date_from],
    ['Date To', s.date_to],
    ['Generated At', new Date(s.generated_at).toLocaleString()],
    ['', ''],
    ['Orders Placed', s.total_orders],
    ['  Pending', s.pending_orders],
    ['  Shipped', s.shipped_orders],
    ['  Cancelled', s.cancelled_orders],
    ['Points Redeemed via Orders', s.points_redeemed_via_orders],
    ['Active Drivers (placed order)', s.active_drivers],
    ['Active Sponsors (had order)', s.active_sponsors],
    ['', ''],
    ['New Driver Registrations', s.new_drivers],
    ['New Sponsor Registrations', s.new_sponsors],
    ['', ''],
    ['Points Awarded', s.points_awarded],
    ['', ''],
    ['Total Logins', s.total_logins],
    ['Failed Logins', s.failed_logins],
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

export function AdminReportsPage() {
  const [view, setView] = useState<View>('redemption');

  // Redemption report state
  const [report, setReport] = useState<RedemptionReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Summary report state
  const [period, setPeriod] = useState<Period>('weekly');
  const [refDate, setRefDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  // ── Redemption report ──
  const handleGenerateReport = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<RedemptionReportResponse>('/admin/reports/redemptions');
      setReport(data);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Failed to load redemption report.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Summary report ──
  const computeDateRange = (): { dateFrom: string; dateTo: string } => {
    const d = new Date(refDate + 'T00:00:00');
    if (period === 'weekly') {
      const start = weekStart(d);
      return { dateFrom: start, dateTo: weekEnd(start) };
    }
    return { dateFrom: monthStart(d), dateTo: monthEnd(d) };
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const { dateFrom, dateTo } = computeDateRange();
      const params = new URLSearchParams({
        period,
        date_from: dateFrom + 'T00:00:00',
        date_to: dateTo + 'T23:59:59',
      });
      const data = await api.get<OperationsSummary>(`/admin/reports/summary?${params}`);
      setSummary(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setSummaryError(apiErr.message || 'Failed to generate report.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!summary) return;
    const { dateFrom, dateTo } = computeDateRange();
    downloadCsv(
      `operations-${period}-${dateFrom}-to-${dateTo}.csv`,
      summaryToCsvRows(summary),
    );
  };

  // ── Redemption totals ──
  const rows = report?.report_rows ?? [];
  const totalRedemptions = rows.reduce((sum, row) => sum + row.total_redemptions, 0);
  const totalPointsRedeemed = rows.reduce((sum, row) => sum + row.total_points_redeemed, 0);
  const totalStockRemaining = rows.reduce((sum, row) => sum + row.current_stock, 0);

  return (
    <section className="card" aria-labelledby="reports-heading">
      <h2 id="reports-heading">Reports</h2>
      <p className="mt-1">
        Generate redemption snapshots or period-based operations summaries.
      </p>

      {/* View toggle */}
      <div className="mt-2" style={{ display: 'flex', gap: '0.5rem' }}>
        <Button type="button" onClick={() => setView('redemption')} disabled={view === 'redemption'}>
          Redemption Report
        </Button>
        <Button type="button" onClick={() => setView('summary')} disabled={view === 'summary'}>
          Operations Summary
        </Button>
      </div>

      {/* ── Redemption Report ── */}
      {view === 'redemption' && (
        <>
          <p className="mt-2 helper-text">
            Snapshot of sponsor stock and order activity up to the present date.
          </p>
          <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateReport}
              disabled={loading}
            >
              {loading ? 'Generating…' : 'Generate Redemption Report'}
            </button>
            {report && (
              <span className="helper-text">
                Generated {new Date(report.generated_at).toLocaleString()}
              </span>
            )}
          </div>

          {error && (
            <div className="mt-2"><Alert variant="error">{error}</Alert></div>
          )}

          {report && (
            <>
              <div className="mt-2" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="card" style={{ minWidth: '160px' }}>
                  <p className="helper-text" style={{ marginBottom: '0.35rem' }}>Total Redemptions</p>
                  <strong>{totalRedemptions.toLocaleString()}</strong>
                </div>
                <div className="card" style={{ minWidth: '160px' }}>
                  <p className="helper-text" style={{ marginBottom: '0.35rem' }}>Points Redeemed</p>
                  <strong>{totalPointsRedeemed.toLocaleString()} pts</strong>
                </div>
                <div className="card" style={{ minWidth: '160px' }}>
                  <p className="helper-text" style={{ marginBottom: '0.35rem' }}>Stock Remaining</p>
                  <strong>{totalStockRemaining.toLocaleString()}</strong>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="placeholder-msg mt-2">No sponsor catalog items are available for reporting yet.</p>
              ) : (
                <div className="card mt-2" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Sponsor</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Item</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Stock</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Redemptions</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Pending</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Shipped</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Cancelled</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Points</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Last Redemption</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.sponsor_id}:${row.item_id}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.sponsor_name}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.item_title}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.current_stock.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.total_redemptions.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.pending_redemptions.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.shipped_redemptions.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.cancelled_redemptions.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.total_points_redeemed.toLocaleString()} pts</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {row.last_redeemed_at ? new Date(row.last_redeemed_at).toLocaleString() : 'No redemptions yet'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Operations Summary ── */}
      {view === 'summary' && (
        <>
          <p className="mt-2 helper-text">
            Key system metrics for a weekly or monthly window.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); handleGenerateSummary(); }}
            className="mt-2"
            style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div className="form-group" style={{ marginBottom: 0, minWidth: '160px' }}>
              <label htmlFor="summary-period">Period</label>
              <select
                id="summary-period"
                value={period}
                onChange={(e) => { setPeriod(e.target.value as Period); setSummary(null); }}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
              <label htmlFor="summary-ref-date">
                {period === 'weekly' ? 'Any date in the week' : 'Any date in the month'}
              </label>
              <input
                id="summary-ref-date"
                type="date"
                value={refDate}
                onChange={(e) => { setRefDate(e.target.value); setSummary(null); }}
                required
              />
            </div>

            <Button type="submit" disabled={summaryLoading}>
              {summaryLoading ? 'Generating…' : 'Generate Report'}
            </Button>
          </form>

          {summaryLoading ? (
            <div className="mt-2"><Spinner label="Generating report…" /></div>
          ) : summaryError ? (
            <div className="mt-2"><Alert variant="error">{summaryError}</Alert></div>
          ) : summary ? (
            <>
              <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="helper-text">
                  {summary.period === 'weekly' ? 'Weekly' : 'Monthly'} report &mdash;{' '}
                  {summary.date_from.slice(0, 10)} to {summary.date_to.slice(0, 10)}{' '}
                  &mdash; generated {new Date(summary.generated_at).toLocaleString()}
                </span>
                <Button type="button" onClick={handleDownloadCsv}>
                  Download CSV
                </Button>
              </div>

              <div className="mt-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                <MetricCard label="Orders Placed" value={summary.total_orders} />
                <MetricCard label="Pending Orders" value={summary.pending_orders} />
                <MetricCard label="Shipped Orders" value={summary.shipped_orders} />
                <MetricCard label="Cancelled Orders" value={summary.cancelled_orders} />
                <MetricCard label="Points Redeemed" value={`${summary.points_redeemed_via_orders.toLocaleString()} pts`} />
                <MetricCard label="Active Drivers" value={summary.active_drivers} />
                <MetricCard label="Active Sponsors" value={summary.active_sponsors} />
                <MetricCard label="New Driver Registrations" value={summary.new_drivers} />
                <MetricCard label="New Sponsor Registrations" value={summary.new_sponsors} />
                <MetricCard label="Points Awarded" value={`${summary.points_awarded.toLocaleString()} pts`} />
                <MetricCard label="Total Logins" value={summary.total_logins} />
                <MetricCard label="Failed Logins" value={summary.failed_logins} />
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="helper-text" style={{ marginBottom: '0.35rem' }}>{label}</p>
      <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
    </div>
  );
}
