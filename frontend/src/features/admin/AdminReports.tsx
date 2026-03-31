import { useState } from 'react';
import { api } from '../../services/apiClient';

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

export function AdminReportsPage() {
  const [report, setReport] = useState<RedemptionReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const rows = report?.report_rows ?? [];
  const totalRedemptions = rows.reduce((sum, row) => sum + row.total_redemptions, 0);
  const totalPointsRedeemed = rows.reduce((sum, row) => sum + row.total_points_redeemed, 0);
  const totalStockRemaining = rows.reduce((sum, row) => sum + row.current_stock, 0);

  return (
    <section className="card" aria-labelledby="reports-heading">
      <h2 id="reports-heading">Reports</h2>
      <p className="mt-1">
        Generate a redemption snapshot up to the present date and time to review sponsor stock and
        order activity.
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
        <p className="error mt-2" role="alert">
          {error}
        </p>
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
    </section>
  );
}
