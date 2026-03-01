import { useEffect, useState} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/apiClient'

interface CatalogItemDetail {
    item_id: string;
    title: string;
    price_value: string | null;
    price_currency: string | null;
    image_url: string | null;
    rating: string | null;
    stock_quantity: number;
    points_cost: number;
    description: string | null;
    condition: string | null;
    additional_images: string[];
    item_specifics: { name: string; value: string }[];
}

export function DriverProductDetail() {
    const { itemId } = useParams<{ itemId: string }>();
    const navigate = useNavigate();
      const [item, setItem] = useState<CatalogItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number>(0);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    Promise.all([
        api.get<CatalogItemDetail>(`/api/driver/catalog/${itemId}`),
        api.get<{ current_points: number; items: unknown[] }>('/api/driver/catalog'),
    ])
    .then(([detail, catalog]) => {
      setItem(detail);
      setCurrentPoints(catalog.current_points);
    })
    .catch(() => setError('Failed to load product details.'))
    .finally(() => setLoading(false));
  }, [itemId]);

  const handleRedeem = async () => {
    if (!item) return;
    setFeedback(null);
    setPurchasing(true);
    try {
      const res = await api.post<{ message: string; new_points_balance: number; remaining_stock: number }>(
        '/api/driver/catalog/purchase',
        { item_id: item.item_id }
      );
      setCurrentPoints(res.new_points_balance);
      setItem(prev => prev ? { ...prev, stock_quantity: res.remaining_stock } : prev);
      setFeedback({ type: 'success', msg: res.message });
    } catch (err: any) {
      const detail = err?.detail ?? err?.message ?? 'Purchase failed.';
      setFeedback({ type: 'error', msg: detail });
    } finally {
      setPurchasing(false);
    }
  };

  /* ui */
  if (loading) return <p>Loading product details…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!item) return <p>Product not found.</p>;

  const canAfford = currentPoints >= item.points_cost;
  const inStock = item.stock_quantity > 0;

  return (
    <section className="card" aria-labelledby="product-detail-heading">
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}
      >
        ← Back to Catalog
      </button>

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

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Image */}
        <div style={{ flexShrink: 0 }}>
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              style={{ width: 240, height: 240, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          ) : (
            <div className="image-placeholder" style={{ width: 240, height: 240 }}>No Image</div>
          )}
          {item.additional_images.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {item.additional_images.slice(0, 4).map((url, i) => (
                <img key={i} src={url} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--color-border)' }} />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 id="product-detail-heading" style={{ marginBottom: '0.5rem' }}>{item.title}</h2>

          {item.condition && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Condition: {item.condition}
            </p>
          )}

          {item.price_value && (
            <p style={{ marginBottom: '0.25rem' }}>
              Market Price: {item.price_value} {item.price_currency}
            </p>
          )}

          <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            {item.points_cost.toLocaleString()} pts
          </p>

          {/* Stock badge */}
          <span style={{
            fontSize: '0.82rem', fontWeight: 600, display: 'inline-block',
            padding: '2px 8px', borderRadius: 9999, marginBottom: '0.75rem',
            color: !inStock ? '#b91c1c' : item.stock_quantity <= 3 ? '#92400e' : '#065f46',
            background: !inStock ? '#fee2e2' : item.stock_quantity <= 3 ? '#fef3c7' : '#d1fae5',
          }}>
            {!inStock ? 'Out of Stock' : item.stock_quantity <= 3 ? `Only ${item.stock_quantity} left!` : `${item.stock_quantity} in stock`}
          </span>

          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Your balance: {currentPoints.toLocaleString()} pts
            {!canAfford && inStock && (
              <span style={{ color: '#9ca3af' }}> — need {(item.points_cost - currentPoints).toLocaleString()} more</span>
            )}
          </p>

          <button
            disabled={!canAfford || !inStock || purchasing}
            onClick={handleRedeem}
            className="btn-primary"
          >
            {purchasing ? 'Redeeming…' : !inStock ? 'Out of Stock' : !canAfford ? 'Not Enough Points' : 'Redeem'}
          </button>
        </div>
      </div>

      {/* Description */}
      {item.description && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Description</h3>
          <p style={{ lineHeight: 1.7 }}>{item.description}</p>
        </div>
      )}

      {/* Specifications */}
      {item.item_specifics.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Specifications</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <tbody>
              {item.item_specifics.map((spec, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, width: '40%' }}>{spec.name}</td>
                  <td style={{ padding: '6px 8px' }}>{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}