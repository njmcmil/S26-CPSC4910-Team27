import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/apiClient';

type OrderStatus = 'pending' | 'shipped' | 'cancelled';

interface SponsorOrder {
  order_id: number;
  item_id: string;
  item_title: string;
  points_cost: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  username: string;
  first_name: string;
  last_name: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Pending',
  shipped:   'Shipped',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<OrderStatus, { color: string; background: string }> = {
  pending:   { color: '#92400e', background: '#fef3c7' },
  shipped:   { color: '#065f46', background: '#d1fae5' },
  cancelled: { color: '#6b7280', background: '#f3f4f6' },
};

const DEBOUNCE_MS = 300;

export function SponsorPurchaseHistory() {
  const [orders, setOrders] = useState<SponsorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverInput, setDriverInput] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOrders = (filter: string) => {
    setLoading(true);
    setError(null);
    const params = filter ? `?driver_name=${encodeURIComponent(filter)}` : '';
    api.get<{ orders: SponsorOrder[] }>(`/api/sponsor/orders${params}`)
      .then(res => setOrders(res.orders))
      .catch(() => setError('Failed to load purchase history.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(''); }, []);

  const handleDriverInput = (value: string) => {
    setDriverInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDriverFilter(value.trim());
      loadOrders(value.trim());
    }, DEBOUNCE_MS);
  };

  const driverDisplayName = (o: SponsorOrder) => {
    const full = `${o.first_name} ${o.last_name}`.trim();
    return full || o.username;
  };

  return (
    <section className="card" aria-labelledby="purchase-history-heading">
      <h2 id="purchase-history-heading">Purchase History</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        All redemptions made by your drivers.
      </p>

      {/* Task 15503: filter by driver name */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Filter by driver name…"
          value={driverInput}
          onChange={e => handleDriverInput(e.target.value)}
          aria-label="Filter by driver name"
          style={{
            width: '100%', maxWidth: 320, padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
          }}
        />
        {driverFilter && (
          <button
            onClick={() => { setDriverInput(''); setDriverFilter(''); loadOrders(''); }}
            style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            Clear
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : orders.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          {driverFilter ? `No orders found for "${driverFilter}".` : 'No orders yet.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>#</th>
              <th style={{ padding: '8px' }}>Driver</th>
              <th style={{ padding: '8px' }}>Item</th>
              <th style={{ padding: '8px' }}>Points</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const badge = STATUS_COLORS[order.status];
              return (
                <tr key={order.order_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px', color: 'var(--color-text-muted)' }}>{order.order_id}</td>
                  <td style={{ padding: '8px' }}>{driverDisplayName(order)}</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
