import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { useAuth } from '../../auth/AuthContext';

type OrderStatus = 'pending' | 'shipped' | 'cancelled';

interface Order {
  order_id: number;
  item_id: string;
  item_title: string;
  points_cost: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<OrderStatus, { color: string; background: string }> = {
  pending:   { color: '#92400e', background: '#fef3c7' },
  shipped:   { color: '#065f46', background: '#d1fae5' },
  cancelled: { color: '#6b7280', background: '#f3f4f6' },
};

export function DriverOrdersPage() {
  const { refreshSponsors } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [reportingIssue, setReportingIssue] = useState<Order | null>(null);
  const [issueType, setIssueType] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const loadOrders = () => {
    setLoading(true);
    api.get<{ orders: Order[] }>('/api/driver/orders')
      .then(res => setOrders(res.orders))
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, []);

  const handleCancel = async (order: Order) => {
    if (!window.confirm(`Cancel order for "${order.item_title}"? Your ${order.points_cost.toLocaleString()} pts will be refunded.`)) return;
    setFeedback(null);
    setCancelling(order.order_id);
    try {
      const res = await api.post<{ message: string; new_points_balance: number }>(
        `/api/driver/orders/${order.order_id}/cancel`
      );
      // Update status locally — no need to refetch
      setOrders(prev =>
        prev.map(o => o.order_id === order.order_id ? { ...o, status: 'cancelled' } : o)
      );
      await refreshSponsors();
      setFeedback({ type: 'success', msg: res.message });
    } catch (err: any) {
      const detail = err?.detail ?? err?.message ?? 'Cancel failed.';
      setFeedback({ type: 'error', msg: detail });
    } finally {
      setCancelling(null);
    }
  };

  const handleReportIssue = async () => {
    if (!reportingIssue || !issueType || !issueDescription) return;
    setSubmittingIssue(true);
    try {
      await api.post(`/api/driver/orders/${reportingIssue.order_id}/report-issue`, {
        issue_type: issueType,
        description: issueDescription,
      });
      setFeedback({ type: 'success', msg: 'Issue reported successfully! Our team will review it.' });
      setReportingIssue(null);
      setIssueType('');
      setIssueDescription('');
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.detail ?? 'Failed to report issue.' });
    } finally {
      setSubmittingIssue(false);
    }
  };

  return (
    <section className="card" aria-labelledby="orders-heading">
      <h2 id="orders-heading">My Orders</h2>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        View and manage your reward redemptions. Pending orders can be cancelled for a full points refund.
      </p>

      {feedback && (
        <div role="alert" style={{
          padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: feedback.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 500,
        }}>
          {feedback.msg}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading orders…</p>
      ) : orders.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No orders yet. Browse the <a href="/driver/catalog">catalog</a> to redeem points.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>#</th>
              <th style={{ padding: '8px' }}>Item</th>
              <th style={{ padding: '8px' }}>Points</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Date</th>
              <th style={{ padding: '8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const badge = STATUS_COLORS[order.status];
              return (
                <tr key={order.order_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px', color: 'var(--color-text-muted)' }}>{order.order_id}</td>
                  <td style={{ padding: '8px' }}>{order.item_title}</td>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{order.points_cost.toLocaleString()} pts</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      fontSize: '0.8rem', fontWeight: 600,
                      padding: '2px 8px', borderRadius: 9999,
                      ...badge,
                    }}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(order)}
                        disabled={cancelling === order.order_id}
                        style={{
                          background: 'none', border: '1px solid var(--color-danger)',
                          color: 'var(--color-danger)', borderRadius: 'var(--radius)',
                          padding: '2px 10px', cursor: 'pointer', fontSize: '0.82rem',
                        }}
                      >
                        {cancelling === order.order_id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                    {order.status !== 'cancelled' && (
                      <button
                        onClick={() => setReportingIssue(order)}
                        style={{
                          background: 'none', border: '1px solid #f59e0b',
                          color: '#b45309', borderRadius: 'var(--radius)',
                          padding: '2px 10px', cursor: 'pointer', fontSize: '0.82rem',
                        }}
                      >
                        Report Issue
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {reportingIssue && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 12, padding: '1.5rem',
            width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Report an Issue</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Order: {reportingIssue.item_title}
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Issue Type
              </label>
              <select value={issueType} onChange={e => setIssueType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                <option value="">Select an issue type...</option>
                <option value="not_received">Item Not Received</option>
                <option value="wrong_item">Wrong Item Received</option>
                <option value="damaged">Item Arrived Damaged</option>
                <option value="late_delivery">Late Delivery</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Description
              </label>
              <textarea
                value={issueDescription}
                onChange={e => setIssueDescription(e.target.value)}
                placeholder="Please describe the issue in detail..."
                rows={4}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button"
                onClick={() => { setReportingIssue(null); setIssueType(''); setIssueDescription(''); }}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button"
                onClick={handleReportIssue}
                disabled={!issueType || !issueDescription || submittingIssue}
                style={{
                  padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
                  background: '#f59e0b', color: '#fff', fontWeight: 700,
                  cursor: !issueType || !issueDescription ? 'not-allowed' : 'pointer',
                  opacity: !issueType || !issueDescription ? 0.6 : 1,
                }}>
                {submittingIssue ? 'Submitting…' : 'Submit Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
