import { useNavigate } from 'react-router-dom';

export function OrderConfirmationPage() {
  const navigate = useNavigate();

  return (
    <section className="card" style={{
      maxWidth: 520, margin: '4rem auto', textAlign: 'center', padding: '3rem 2rem',
    }}>
      {/* Success icon */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%', background: '#dcfce7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2rem', margin: '0 auto 1.5rem',
      }}>
        ✅
      </div>

      <h2 style={{ marginBottom: '0.5rem', color: '#15803d' }}>Order Placed!</h2>

      <p style={{ color: '#374151', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
        Your order was successfully placed using your points.
      </p>

      <p style={{
        color: '#6b7280', fontSize: '0.95rem', marginBottom: '2rem',
        background: '#f3f4f6', borderRadius: 8, padding: '0.75rem 1rem', display: 'inline-block',
      }}>
        📦 Your order will arrive in <strong>2 business days</strong>
      </p>

      <div>
        <button
          onClick={() => navigate('/driver/catalog')}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '0.7rem 2rem', fontWeight: 700,
            cursor: 'pointer', fontSize: '1rem',
          }}
        >
          ← Back to Catalog
        </button>
      </div>
    </section>
  );
}
