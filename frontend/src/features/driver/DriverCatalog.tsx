import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/apiClient';

interface CatalogItem {
  item_id: string;
  title: string;
  price_value: string | null;
  price_currency: string | null;
  image_url: string | null;
  rating: string | null;
  stock_quantity: number;
  points_cost: number;
}

interface Props {
  previewMode?: boolean;
}

const DEBOUNCE_MS = 250;

export function DriverCatalog({ previewMode = false }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // client-side search
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setSearchQuery(value.trim().toLowerCase()), DEBOUNCE_MS);
  };

  // filter items by search query (client-side, catalog already loaded)
  const visibleItems = useMemo(
    () =>
      searchQuery
        ? items.filter(i => i.title.toLowerCase().includes(searchQuery))
        : items,
    [items, searchQuery]
  );

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      // US-38: returns current_points for balance check
      // US-39: returns stock_quantity per item
      const res = await api.get<{ current_points: number; items: CatalogItem[] }>(
        '/api/driver/catalog'
      );
      setPoints(res.current_points);
      setItems(res.items);
    } catch (err) {
      console.error('Failed to load catalog', err);
      setError('Failed to load catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleRedeem = async (item: CatalogItem) => {
    if (previewMode) return;
    setFeedback(null);
    setPurchasing(item.item_id);
    try {
      const res = await api.post<{
        message: string;
        new_points_balance: number;
        remaining_stock: number;
      }>('/api/driver/catalog/purchase', { item_id: item.item_id });

      setPoints(res.new_points_balance);
      setItems(prev =>
        prev.map(i =>
          i.item_id === item.item_id ? { ...i, stock_quantity: res.remaining_stock } : i
        )
      );
      setFeedback({ type: 'success', msg: res.message });
    } catch (err: any) {
      // US-38: backend sends detailed message when points are insufficient
      const detail = err?.detail ?? err?.message ?? 'Purchase failed.';
      setFeedback({ type: 'error', msg: detail });
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div>
      <div className="points-banner">
        <h2>Your Available Points: {points.toLocaleString()}</h2>
        {previewMode && (
          <p className="text-sm text-gray-500">Sponsor Preview — Purchase Disabled</p>
        )}
      </div>
      
      {/* search bar */}
      {!previewMode && (
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="search"
            placeholder="Search catalog…"
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            aria-label="Search catalog"
            style={{ width: '100%', maxWidth: 360, padding: '0.4rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}
          />
        </div>
      )}

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
        <p>Loading catalog...</p>
      ) : (
        <div className="catalog-grid">
          {visibleItems.length === 0 ? (
            <p>{searchQuery ? 'No products match your search.' : 'No sponsor products available.'}</p>
          ) : (
            visibleItems.map(item => {
              const canAfford = points >= item.points_cost;
              const inStock = item.stock_quantity > 0;
              const isLoading = purchasing === item.item_id;

              return (
                <div key={item.item_id} className="product-card" style={{ opacity: inStock ? 1 : 0.6 }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} />
                  ) : (
                    <div className="image-placeholder">No Image</div>
                  )}

                  <h3>{item.title}</h3>

                  {/* Points cost */}
                  <p style={{ fontWeight: 700 }}>{item.points_cost.toLocaleString()} pts</p>

                  {/* US-39: stock badge always visible */}
                  <p style={{
                    fontSize: '0.82rem', fontWeight: 600, display: 'inline-block',
                    padding: '2px 8px', borderRadius: 9999, marginBottom: '0.5rem',
                    color: !inStock ? '#b91c1c' : item.stock_quantity <= 3 ? '#92400e' : '#065f46',
                    background: !inStock ? '#fee2e2' : item.stock_quantity <= 3 ? '#fef3c7' : '#d1fae5',
                  }}>
                    {!inStock
                      ? 'Out of Stock'
                      : item.stock_quantity <= 3
                      ? `Only ${item.stock_quantity} left!`
                      : `${item.stock_quantity} in stock`}
                  </p>

                  {/* US-38: affordability hint */}
                  {!previewMode && !canAfford && inStock && (
                    <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.4rem' }}>
                      Need {(item.points_cost - points).toLocaleString()} more pts
                    </p>
                  )}

                  {/* link to product details page */}
                  {!previewMode && (
                    <Link
                      to={`/driver/catalog/${item.item_id}`}
                      style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.4rem', color: 'var(--color-primary)' }}
                    >
                      View Details
                    </Link>
                  )}

                  <button
                    disabled={previewMode || !canAfford || !inStock || isLoading}
                    onClick={() => handleRedeem(item)}
                  >
                    {previewMode ? 'Preview Only'
                      : isLoading ? 'Redeeming…'
                      : !inStock ? 'Out of Stock'
                      : !canAfford ? 'Not Enough Points'
                      : 'Redeem'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
