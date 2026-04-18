import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/apiClient';
import { useCart } from '../../auth/CartContext';
import { useAuth } from '../../auth/AuthContext';

export function CheckoutPage() {
  const { items, totalPoints, clearCart } = useCart();
  const { refreshSponsors } = useAuth();
  const navigate = useNavigate();

  const [currentPoints, setCurrentPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/driver/cart', { replace: true });
      return;
    }

    const sponsorUserId = items[0]?.sponsor_user_id;
    if (!sponsorUserId) {
      setError('Could not determine which sponsor catalog this order belongs to.');
      setLoading(false);
      return;
    }

    // Fetch fresh point balance
    api.get<{ current_points: number; items: unknown[] }>(`/api/driver/catalog?sponsor_user_id=${sponsorUserId}`)
      .then(res => setCurrentPoints(res.current_points))
      .catch(() => setError('Could not load your point balance.'))
      .finally(() => setLoading(false));
  }, []);

  const canAfford = currentPoints !== null && currentPoints >= totalPoints;
  const remaining = currentPoints !== null ? currentPoints - totalPoints : null;

  const handlePlaceOrder = async () => {
    if (!canAfford || placing) return;
    setPlacing(true);
    setError(null);

    try {
      // Place each item as a purchase
      for (const item of items) {
        await api.post('/api/driver/catalog/purchase', {
          item_id: item.item_id,
          sponsor_user_id: item.sponsor_user_id,
        });
      }
      await refreshSponsors();
      clearCart();
      navigate('/driver/order-confirmation', { replace: true });
    } catch (err: any) {
      const detail = err?.detail ?? err?.message ?? 'Order failed. Please try again.';
      setError(detail);
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <section className="card" style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
        <p>Loading checkout...</p>
      </section>
    );
  }

  return (
    <section className="card" style={{ maxWidth: 620, margin: '2rem auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Checkout</h2>

      {/* Item list */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Order Summary
        </h3>
        {items.map(item => (
          <div key={item.item_id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 6, background: '#e5e7eb' }} />
              )}
              <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>{item.title}</span>
            </div>
            <span style={{ fontWeight: 700, color: '#1e40af', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
              {item.points_cost.toLocaleString()} pts
            </span>
          </div>
        ))}
      </div>

      {/* Points breakdown */}
      <div style={{
        background: '#f8fafc', borderRadius: 10, padding: '1rem 1.25rem',
        marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#6b7280' }}>
          <span>Current balance</span>
          <span style={{ fontWeight: 600, color: '#374151' }}>
            {currentPoints?.toLocaleString() ?? '—'} pts
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#6b7280' }}>
          <span>Order total</span>
          <span style={{ fontWeight: 600, color: '#dc2626' }}>
            − {totalPoints.toLocaleString()} pts
          </span>
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>Remaining balance</span>
          <span style={{
            fontWeight: 700, fontSize: '1.1rem',
            color: canAfford ? '#16a34a' : '#dc2626',
          }}>
            {remaining !== null ? remaining.toLocaleString() : '—'} pts
          </span>
        </div>
      </div>

      {/* Not enough points warning */}
      {!canAfford && currentPoints !== null && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', borderRadius: 8,
          padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 500,
        }}>
          You need {(totalPoints - currentPoints).toLocaleString()} more points to place this order.
        </div>
      )}

      {error && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', borderRadius: 8,
          padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/driver/cart')}
          style={{
            background: 'none', border: '1px solid #d1d5db', borderRadius: 8,
            padding: '0.6rem 1.2rem', cursor: 'pointer', fontSize: '0.95rem', color: '#374151',
          }}
        >
          ← Back to Cart
        </button>

        <button
          onClick={handlePlaceOrder}
          disabled={!canAfford || placing}
          style={{
            background: canAfford ? '#2563eb' : '#9ca3af',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '0.6rem 1.8rem', fontWeight: 700,
            cursor: canAfford && !placing ? 'pointer' : 'not-allowed',
            fontSize: '0.95rem',
          }}
        >
          {placing ? 'Placing Order…' : 'Place Order'}
        </button>
      </div>
    </section>
  );
}
