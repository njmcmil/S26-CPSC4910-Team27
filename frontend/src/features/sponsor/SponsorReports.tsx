import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────

interface Driver {
  driver_user_id: number;
  username: string;
}

interface PointHistoryRow {
  date: string;
  points_changed: number;
  reason: string;
  changed_by_user_id: number;
  expires_at: string | null;
}

interface AuditLogRow {
  date: string;
  changed_by_user_id: number | null;
  changed_by_username: string | null;
  reason: string | null;
}

type ReportType = 'point-tracking' | 'audit-log';

// ── CSV Helper ─────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: object[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = (r as any)[h];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Styles ─────────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  textAlign: 'left', padding: '0.6rem 0.75rem',
  borderBottom: '2px solid var(--color-border)',
  fontWeight: 600, whiteSpace: 'nowrap', background: '#f8fafc',
};

const td: React.CSSProperties = {
  padding: '0.55rem 0.75rem',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top',
};

// ── Main Component ─────────────────────────────────────────────────────────

export function SponsorReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('point-tracking');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [auditCategory, setAuditCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    api.get<{ drivers: Driver[] }>('/sponsor/drivers')
      .then(d => setDrivers(d.drivers ?? d))
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true); setError(''); setResults(null);
    try {
      if (reportType === 'point-tracking') {
        if (!driverId) { setError('Please select a driver.'); setLoading(false); return; }
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        const qs = params.toString();
        const data = await api.get<any>(`/api/sponsor/drivers/${driverId}/point-history${qs ? '?' + qs : ''}`);
        setResults({ type: 'point-tracking', data });
      } else {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (auditCategory) params.set('category', auditCategory);
        const qs = params.toString();
        const data = await api.get<any>(`/sponsor/audit-logs${qs ? '?' + qs : ''}`);
        setResults({ type: 'audit-log', data });
      }
    } catch {
      setError('Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleCSV = () => {
    if (!results) return;
    const now = new Date().toISOString().slice(0, 10);
    if (results.type === 'point-tracking') {
      const rows = (results.data.history ?? []).map((r: PointHistoryRow) => ({
        date: r.date,
        points_changed: r.points_changed,
        reason: r.reason,
        expires_at: r.expires_at ?? '',
      }));
      downloadCSV(`point_tracking_${now}.csv`, rows);
    } else {
      const rows = (results.data.logs ?? results.data ?? []).map((r: AuditLogRow) => ({
        date: r.date,
        user: r.changed_by_username ?? '',
        reason: r.reason ?? '',
      }));
      downloadCSV(`audit_log_${now}.csv`, rows);
    }
  };

  const selectedDriver = drivers.find(d => String(d.driver_user_id) === driverId);

  return (
    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading">Sponsor Reports</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Generate reports on driver point activity and audit logs for your organization.
      </p>

      {/* Report type tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', margin: '1.25rem 0 1rem', flexWrap: 'wrap' }}>
        {([
          ['point-tracking', 'Driver Point Tracking'],
          ['audit-log', 'Audit Log'],
        ] as [ReportType, string][]).map(([type, label]) => (
          <button key={type} type="button"
            onClick={() => { setReportType(type); setResults(null); }}
            style={{
              padding: '0.45rem 1rem', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontSize: '0.875rem',
              background: reportType === type ? '#2563eb' : 'var(--color-surface)',
              color: reportType === type ? '#fff' : 'var(--color-text)',
              fontWeight: reportType === type ? 700 : 400,
              boxShadow: reportType === type ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Filters</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {reportType === 'point-tracking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Driver</label>
              <select value={driverId} onChange={e => setDriverId(e.target.value)}
                style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                <option value="">Select a driver...</option>
                {drivers.map(d => <option key={d.driver_user_id} value={d.driver_user_id}>{d.username}</option>)}
              </select>
            </div>
          )}

          {reportType === 'audit-log' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Category</label>
              <select value={auditCategory} onChange={e => setAuditCategory(e.target.value)}
                style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                <option value="">All Categories</option>
                <option value="point_change">Point Changes</option>
                <option value="driver_dropped">Driver Dropped</option>
              </select>
            </div>
          )}

          {(['Start Date', 'End Date'] as const).map((label, i) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{label}</label>
              <input type="date"
                value={i === 0 ? startDate : endDate}
                onChange={e => i === 0 ? setStartDate(e.target.value) : setEndDate(e.target.value)}
                style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }} />
            </div>
          ))}

          <button type="button" onClick={handleGenerate} disabled={loading}
            style={{
              padding: '0.5rem 1.4rem', borderRadius: 8, border: 'none',
              background: '#2563eb', color: '#fff', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? 'Generating…' : 'Generate Report'}
          </button>

          {results && (
            <button type="button" onClick={handleCSV}
              style={{
                padding: '0.5rem 1.2rem', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
              }}>
              ⬇ Download CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Point Tracking Results */}
      {results?.type === 'point-tracking' && (() => {
        const history: PointHistoryRow[] = results.data.history ?? [];
        const currentPoints = results.data.current_points ?? 0;
        return (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>
                Point History — {selectedDriver?.username}
              </h3>
              <div style={{ background: '#eff6ff', borderRadius: 8, padding: '0.4rem 0.9rem', fontSize: '0.9rem', fontWeight: 600, color: '#1e40af' }}>
                Current Balance: {currentPoints.toLocaleString()} pts
              </div>
            </div>
            {history.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>No point history found for this driver.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Date</th>
                  <th style={th}>Points Changed</th>
                  <th style={th}>Reason</th>
                  <th style={th}>Expires</th>
                </tr></thead>
                <tbody>{history.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{new Date(r.date).toLocaleString()}</td>
                    <td style={td}>
                      <span style={{ color: r.points_changed >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {r.points_changed >= 0 ? '+' : ''}{r.points_changed}
                      </span>
                    </td>
                    <td style={td}>{r.reason}</td>
                    <td style={td}>{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        );
      })()}

      {/* Audit Log Results */}
      {results?.type === 'audit-log' && (() => {
        const logs: AuditLogRow[] = results.data.logs ?? results.data ?? [];
        return (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>Audit Log</h3>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>No audit log entries found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Time</th>
                  <th style={th}>User</th>
                  <th style={th}>Action / Reason</th>
                </tr></thead>
                <tbody>{logs.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{new Date(r.date).toLocaleString()}</td>
                    <td style={td}>{r.changed_by_username ?? '—'}</td>
                    <td style={td}>{r.reason ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        );
      })()}
    </section>
  );
}
