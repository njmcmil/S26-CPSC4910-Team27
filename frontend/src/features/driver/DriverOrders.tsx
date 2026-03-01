import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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
      setFeedback({ type: 'success', msg: res.message });
    } catch (err: any) {
      const detail = err?.detail ?? err?.message ?? 'Cancel failed.';
      setFeedback({ type: 'error', msg: detail });
    } finally {
      setCancelling(null);
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
                  <td style={{ padding: '8px' }}>
                    {/* Task 15507: cancel only allowed on pending */}
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

