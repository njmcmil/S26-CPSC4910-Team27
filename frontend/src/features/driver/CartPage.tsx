import { useNavigate } from 'react-router-dom';
import { useCart } from '../../auth/CartContext';

export function CartPage() {
  const { items, removeItem, totalPoints, totalCount } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <section className="card" style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Your cart is empty</h2>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Browse the catalog and add items to get started.
        </p>
        <button
          type="button"
          onClick={() => navigate('/driver/catalog')}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 600,
            cursor: 'pointer', fontSize: '0.95rem',
          }}
        >
          ← Back to Catalog
        </button>
      </section>
    );
  }

  return (
    <section className="card" style={{ maxWidth: 700, margin: '2rem auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Your Cart ({totalCount} item{totalCount !== 1 ? 's' : ''})</h2>
        <button
          type="button"
          onClick={() => navigate('/driver/catalog')}
          style={{
            background: 'none', border: '1px solid #d1d5db', borderRadius: 8,
            padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: '#374151',
          }}
        >
          ← Continue Shopping
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {items.map(item => (
          <div
            key={item.item_id}
            style={{
              display: 'flex', gap: '1rem', alignItems: 'center',
              padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 10,
              background: '#fafafa',
            }}
          >
            {/* Image preview */}
            <div style={{ flexShrink: 0 }}>
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title}
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
                />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: 8, background: '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', color: '#9ca3af',
                }}>
                  No Image
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, margin: '0 0 0.25rem', fontSize: '0.95rem' }}>
                {item.title}
              </p>
              <p style={{ margin: 0, color: '#2563eb', fontWeight: 700 }}>
                {item.points_cost.toLocaleString()} pts
              </p>
              <p style={{
                margin: '0.2rem 0 0',
                fontSize: '0.78rem',
                color: item.stock_quantity <= 3 ? '#92400e' : '#6b7280',
              }}>
                {item.stock_quantity <= 3
                  ? `⚠ Only ${item.stock_quantity} left in stock`
                  : `${item.stock_quantity} in stock`}
              </p>
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeItem(item.item_id, item.sponsor_user_id)}
              style={{
                background: 'none', border: '1px solid #fca5a5', borderRadius: 8,
                padding: '0.35rem 0.75rem', cursor: 'pointer',
                color: '#dc2626', fontSize: '0.85rem', fontWeight: 500, flexShrink: 0,
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        borderTop: '2px solid #e5e7eb', paddingTop: '1.25rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '1rem',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>Total cost</p>
          <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#1e40af' }}>
            {totalPoints.toLocaleString()} pts
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/driver/checkout')}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '0.7rem 2rem', fontWeight: 700,
            cursor: 'pointer', fontSize: '1rem',
          }}
        >
          Checkout →
        </button>
      </div>
    </section>
  );
}
