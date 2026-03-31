import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { ApiError } from '../../types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Sponsor { user_id: number; name: string; }
interface Driver { user_id: number; username: string; }

interface SalesSummaryRow {
  sponsor_name?: string;
  driver_username?: string;
  total_orders: number;
  total_points: number;
  first_order?: string;
  last_order?: string;
  fee_generated?: number;
}

interface SalesDetailRow {
  order_id: number;
  created_at: string;
  sponsor_name?: string;
  driver_username?: string;
  item_title: string;
  points_cost: number;
  status: string;
}

interface InvoiceDriver {
  driver_username: string;
  order_count: number;
  total_points: number;
  fee_generated: number;
}

interface Invoice {
  sponsor_name: string;
  sponsor_email: string;
  drivers: InvoiceDriver[];
  total_fee: number;
  total_points: number;
}

interface AuditRow {
  date: string;
  category: string;
  sponsor_name: string | null;
  driver_username: string | null;
  points_changed: number | null;
  reason: string | null;
}

type ReportType = 'sales-by-sponsor' | 'sales-by-driver' | 'invoice' | 'audit-log' | 'redemptions';

// ── Helpers ────────────────────────────────────────────────────────────────

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

function SelectField({ label, value, onChange, children }: {
  label: string; value: string;
  onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
        {children}
      </select>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AdminReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('sales-by-sponsor');
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sponsorId, setSponsorId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [view, setView] = useState<'summary' | 'detailed'>('summary');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    api.get<{ sponsors: Sponsor[] }>('/admin/reports/sponsors').then(d => setSponsors(d.sponsors)).catch(() => {});
  }, []);

  useEffect(() => {
    const url = sponsorId ? `/admin/reports/drivers?sponsor_id=${sponsorId}` : '/admin/reports/drivers';
    api.get<{ drivers: Driver[] }>(url).then(d => setDrivers(d.drivers)).catch(() => {});
    setDriverId('');
  }, [sponsorId]);

  const buildQuery = () => {
    const p = new URLSearchParams();
    if (sponsorId) p.set('sponsor_id', sponsorId);
    if (driverId) p.set('driver_id', driverId);
    if (startDate) p.set('start_date', startDate);
    if (endDate) p.set('end_date', endDate);
    if (reportType === 'sales-by-sponsor' || reportType === 'sales-by-driver') p.set('view', view);
    if (reportType === 'audit-log' && category) p.set('category', category);
    return p.toString();
  };

  const handleGenerate = async () => {
    setLoading(true); setError(''); setResults(null);
    try {
      const qs = buildQuery();
      const endpointMap: Record<ReportType, string> = {
        'sales-by-sponsor': '/admin/reports/sales-by-sponsor',
        'sales-by-driver': '/admin/reports/sales-by-driver',
        'invoice': '/admin/reports/invoice',
        'audit-log': '/admin/reports/audit-log',
        'redemptions': '/admin/reports/redemptions',
      };
      const data = await api.get<any>(`${endpointMap[reportType]}${qs ? '?' + qs : ''}`);
      setResults(data);
    } catch {
      setError('Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleCSV = () => {
    if (!results) return;
    const now = new Date().toISOString().slice(0, 10);
    if (reportType === 'invoice') {
      const flat = (results.invoices as Invoice[]).flatMap(inv =>
        inv.drivers.map(d => ({
          sponsor: inv.sponsor_name,
          sponsor_email: inv.sponsor_email,
          driver: d.driver_username,
          orders: d.order_count,
          points: d.total_points,
          fee: d.fee_generated,
        }))
      );
      downloadCSV(`invoice_${now}.csv`, flat);
    } else if (reportType === 'redemptions') {
      downloadCSV(`redemptions_${now}.csv`, results.report_rows ?? []);
    } else {
      downloadCSV(`${reportType}_${now}.csv`, results.rows ?? []);
    }
  };

  const summaryCardStyle: React.CSSProperties = {
    background: '#f0f9ff', borderRadius: 10, padding: '0.75rem 1rem',
    minWidth: 140, textAlign: 'center',
  };

  return (
    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading">Admin Reports</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Generate platform-wide reports on sales, drivers, sponsors, and audit activity.
      </p>

      {/* Report type selector */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1.25rem 0 1rem' }}>
        {([
          ['sales-by-sponsor', 'Sales by Sponsor'],
          ['sales-by-driver', 'Sales by Driver'],
          ['invoice', 'Invoice'],
          ['audit-log', 'Audit Log'],
          ['redemptions', 'Redemptions'],
        ] as [ReportType, string][]).map(([type, label]) => (
          <button key={type} type="button" onClick={() => { setReportType(type); setResults(null); }}
            style={{
              padding: '0.45rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.875rem',
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
          {reportType !== 'redemptions' && (
            <SelectField label="Sponsor" value={sponsorId} onChange={setSponsorId}>
              <option value="">All Sponsors</option>
              {sponsors.map(s => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </SelectField>
          )}

          {reportType === 'sales-by-driver' && (
            <SelectField label="Driver" value={driverId} onChange={setDriverId}>
              <option value="">All Drivers</option>
              {drivers.map(d => <option key={d.user_id} value={d.user_id}>{d.username}</option>)}
            </SelectField>
          )}

          {reportType !== 'redemptions' && (
            <>
              <DateField label="Start Date" value={startDate} onChange={setStartDate} />
              <DateField label="End Date" value={endDate} onChange={setEndDate} />
            </>
          )}

          {(reportType === 'sales-by-sponsor' || reportType === 'sales-by-driver') && (
            <SelectField label="View" value={view} onChange={v => setView(v as 'summary' | 'detailed')}>
              <option value="summary">Summary</option>
              <option value="detailed">Detailed</option>
            </SelectField>
          )}

          {reportType === 'audit-log' && (
            <SelectField label="Category" value={category} onChange={setCategory}>
              <option value="">All Categories</option>
              <option value="point_change">Point Changes</option>
              <option value="driver_dropped">Driver Dropped</option>
            </SelectField>
          )}

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

      {/* Results */}
      {results && (
        <div className="card" style={{ overflowX: 'auto' }}>

          {/* Sales by Sponsor */}
          {reportType === 'sales-by-sponsor' && (() => {
            const rows: any[] = results.rows ?? [];
            const totalPts = rows.reduce((s, r) => s + (r.total_points || 0), 0);
            const totalOrders = rows.reduce((s, r) => s + (r.total_orders || 0), 0);
            return (
              <>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div style={summaryCardStyle}><p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Total Orders</p><strong style={{ fontSize: '1.4rem' }}>{totalOrders.toLocaleString()}</strong></div>
                  <div style={summaryCardStyle}><p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Total Points</p><strong style={{ fontSize: '1.4rem' }}>{totalPts.toLocaleString()}</strong></div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {view === 'summary' ? <>
                      <th style={th}>Sponsor</th><th style={th}>Orders</th><th style={th}>Points</th><th style={th}>First Order</th><th style={th}>Last Order</th>
                    </> : <>
                      <th style={th}>Order ID</th><th style={th}>Date</th><th style={th}>Sponsor</th><th style={th}>Driver</th><th style={th}>Item</th><th style={th}>Points</th><th style={th}>Status</th>
                    </>}
                  </tr></thead>
                  <tbody>{rows.map((r, i) => (
                    <tr key={i}>{view === 'summary' ? <>
                      <td style={td}>{r.sponsor_name}</td><td style={td}>{r.total_orders?.toLocaleString()}</td><td style={td}>{r.total_points?.toLocaleString()} pts</td>
                      <td style={td}>{r.first_order ? new Date(r.first_order).toLocaleDateString() : '—'}</td><td style={td}>{r.last_order ? new Date(r.last_order).toLocaleDateString() : '—'}</td>
                    </> : <>
                      <td style={td}>{r.order_id}</td><td style={td}>{new Date(r.created_at).toLocaleString()}</td><td style={td}>{r.sponsor_name}</td>
                      <td style={td}>{r.driver_username}</td><td style={td}>{r.item_title}</td><td style={td}>{r.points_cost?.toLocaleString()} pts</td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600, background: r.status === 'pending' ? '#fef3c7' : r.status === 'shipped' ? '#d1fae5' : '#fee2e2', color: r.status === 'pending' ? '#92400e' : r.status === 'shipped' ? '#065f46' : '#991b1b' }}>{r.status}</span></td>
                    </>}
                    </tr>
                  ))}</tbody>
                </table>
              </>
            );
          })()}

          {/* Sales by Driver */}
          {reportType === 'sales-by-driver' && (() => {
            const rows: any[] = results.rows ?? [];
            const totalPts = rows.reduce((s, r) => s + (r.total_points || r.points_cost || 0), 0);
            return (
              <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={summaryCardStyle}><p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Total Points</p><strong style={{ fontSize: '1.4rem' }}>{totalPts.toLocaleString()}</strong></div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {view === 'summary' ? <>
                      <th style={th}>Driver</th><th style={th}>Sponsor</th><th style={th}>Orders</th><th style={th}>Points</th>
                    </> : <>
                      <th style={th}>Order ID</th><th style={th}>Date</th><th style={th}>Driver</th><th style={th}>Sponsor</th><th style={th}>Item</th><th style={th}>Points</th><th style={th}>Status</th>
                    </>}
                  </tr></thead>
                  <tbody>{rows.map((r, i) => (
                    <tr key={i}>{view === 'summary' ? <>
                      <td style={td}>{r.driver_username}</td><td style={td}>{r.sponsor_name}</td><td style={td}>{r.total_orders?.toLocaleString()}</td><td style={td}>{r.total_points?.toLocaleString()} pts</td>
                    </> : <>
                      <td style={td}>{r.order_id}</td><td style={td}>{new Date(r.created_at).toLocaleString()}</td><td style={td}>{r.driver_username}</td>
                      <td style={td}>{r.sponsor_name}</td><td style={td}>{r.item_title}</td><td style={td}>{r.points_cost?.toLocaleString()} pts</td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600, background: r.status === 'pending' ? '#fef3c7' : '#d1fae5', color: r.status === 'pending' ? '#92400e' : '#065f46' }}>{r.status}</span></td>
                    </>}
                    </tr>
                  ))}</tbody>
                </table>
              </>
            );
          })()}

          {/* Invoice */}
          {reportType === 'invoice' && (() => {
            const invoices: Invoice[] = results.invoices ?? [];
            const grandTotal = invoices.reduce((s, i) => s + i.total_fee, 0);
            return (
              <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={summaryCardStyle}><p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Grand Total Due</p><strong style={{ fontSize: '1.4rem' }}>${grandTotal.toFixed(2)}</strong></div>
                </div>
                {invoices.map((inv, i) => (
                  <div key={i} style={{ marginBottom: '2rem', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: '#1e40af', color: '#fff', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{inv.sponsor_name}</strong>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>{inv.sponsor_email}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Total Due</p>
                        <strong style={{ fontSize: '1.2rem' }}>${inv.total_fee.toFixed(2)}</strong>
                      </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        <th style={th}>Driver</th><th style={th}>Orders</th><th style={th}>Points Used</th><th style={th}>Fee Generated</th>
                      </tr></thead>
                      <tbody>
                        {inv.drivers.map((d, j) => (
                          <tr key={j}>
                            <td style={td}>{d.driver_username}</td>
                            <td style={td}>{d.order_count}</td>
                            <td style={td}>{d.total_points.toLocaleString()} pts</td>
                            <td style={td}>${d.fee_generated.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f0f9ff', fontWeight: 700 }}>
                          <td style={td}>Total</td><td style={td}></td>
                          <td style={td}>{inv.total_points.toLocaleString()} pts</td>
                          <td style={td}>${inv.total_fee.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </>
            );
          })()}

          {/* Audit Log */}
          {reportType === 'audit-log' && (() => {
            const rows: AuditRow[] = results.rows ?? [];
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Date</th><th style={th}>Category</th><th style={th}>Sponsor</th><th style={th}>Driver</th><th style={th}>Points</th><th style={th}>Reason</th>
                </tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{new Date(r.date).toLocaleString()}</td>
                    <td style={td}>{r.category}</td>
                    <td style={td}>{r.sponsor_name ?? '—'}</td>
                    <td style={td}>{r.driver_username ?? '—'}</td>
                    <td style={td}>{r.points_changed !== null ? <span style={{ color: (r.points_changed ?? 0) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{(r.points_changed ?? 0) >= 0 ? '+' : ''}{r.points_changed}</span> : '—'}</td>
                    <td style={td}>{r.reason ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            );
          })()}

          {/* Redemptions */}
          {reportType === 'redemptions' && (() => {
            const rows = results.report_rows ?? [];
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Sponsor</th><th style={th}>Item</th><th style={th}>Stock</th><th style={th}>Redemptions</th><th style={th}>Pending</th><th style={th}>Shipped</th><th style={th}>Cancelled</th><th style={th}>Points</th><th style={th}>Last Redemption</th>
                </tr></thead>
                <tbody>{rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={td}>{r.sponsor_name}</td><td style={td}>{r.item_title}</td>
                    <td style={td}>{r.current_stock}</td><td style={td}>{r.total_redemptions}</td>
                    <td style={td}>{r.pending_redemptions}</td><td style={td}>{r.shipped_redemptions}</td>
                    <td style={td}>{r.cancelled_redemptions}</td><td style={td}>{r.total_points_redeemed} pts</td>
                    <td style={td}>{r.last_redeemed_at ? new Date(r.last_redeemed_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            );
          })()}

        </div>
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
