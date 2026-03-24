import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/apiClient';
import { useCart } from '../../auth/CartContext';
import { useAuth } from '../../auth/AuthContext';
import type { CartItem } from '../../auth/CartContext';

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
const POLL_INTERVAL_MS = 30_000;

export function DriverCatalog({ previewMode = false }: Props) {
  const { activeSponsorId } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const { addItem, items: cartItems, totalCount } = useCart();
  const navigate = useNavigate();

  // client-side search
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null); 

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

  const loadCatalog = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // US-38: returns current_points for balance check
      // US-39: returns stock_quantity per item
      const url = activeSponsorId
        ? `/api/driver/catalog?sponsor_id=${activeSponsorId}`
        : '/api/driver/catalog';
      const res = await api.get<{ current_points: number; items: CatalogItem[] }>(url); 
      setPoints(res.current_points);
      setItems(res.items);
    } catch (err) {
      console.error('Failed to load catalog', err);
      if (!silent) setError('Failed to load catalog.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadSaved = async () => {
    try {
      const res = await api.get<{ saved_item_ids: string[] }>('/api/driver/saved-products');
      setSavedIds(new Set(res.saved_item_ids));
    } catch {
      // silently fail- save buttons just won't reflect server state
    }
  };

  useEffect(() => {
    loadCatalog();
    if (!previewMode) {
      loadSaved();
      pollRef.current = setInterval(() => loadCatalog(true), POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [previewMode, activeSponsorId]);

  const toggleSave = async (item_id: string) => {
    const alreadySaved = savedIds.has(item_id);
    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev);
      alreadySaved ? next.delete(item_id) : next.add(item_id);
      return next;
    });
    try {
      if (alreadySaved) {
        await api.delete(`/api/driver/saved-products/${item_id}`);
      } else {
        await api.post('/api/driver/saved-products', { item_id });
      }
    } catch {
      // Revert on failure
      setSavedIds(prev => {
        const next = new Set(prev);
        alreadySaved ? next.add(item_id) : next.delete(item_id);
        return next;
      });
    }
  };

  const handleAddToCart = (item: CatalogItem) => {
    if (previewMode) return;
    setFeedback(null);

    const alreadyInCart = cartItems.some(i => i.item_id === item.item_id);
    if (alreadyInCart) {
      setFeedback({ type: 'error', msg: `'${item.title}' is already in your cart.` });
      return;
    }

    const cartItem: Omit<CartItem, 'quantity'> = {
      item_id: item.item_id,
      title: item.title,
      points_cost: item.points_cost,
      image_url: item.image_url,
      stock_quantity: item.stock_quantity,
    };
    addItem(cartItem);

    setAddedIds(prev => new Set(prev).add(item.item_id));
    setFeedback({ type: 'success', msg: `'${item.title}' added to cart.` });

    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(item.item_id);
        return next;
      });
    }, 2000);
  };

  const isInCart = (item_id: string) => cartItems.some(i => i.item_id === item_id);

  return (
    <div>
      <div className="points-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2>Your Available Points: {points.toLocaleString()}</h2>

        {!previewMode && (
          <button
            onClick={() => navigate('/driver/cart')}
            style={{
              background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 600,
              cursor: 'pointer', fontSize: '0.95rem', display: 'flex',
              alignItems: 'center', gap: '0.5rem',
            }}
          >
            View Cart
            {totalCount > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff', borderRadius: '9999px',
                fontSize: '0.75rem', fontWeight: 700, padding: '1px 7px',
              }}>
                {totalCount}
              </span>
            )}
          </button>
        )}

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
              const inCart = isInCart(item.item_id);
              const justAdded = addedIds.has(item.item_id);
              const isSaved = savedIds.has(item.item_id);

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

                  {/* save/unsave toggle */}
                  {!previewMode && (
                    <button
                      type="button"
                      onClick={() => toggleSave(item.item_id)}
                      style={{
                        background: 'none', border: '1px solid var(--color-border)',
                        borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                        padding: '3px 10px', marginBottom: '0.4rem',
                        color: isSaved ? '#b45309' : 'var(--color-text-muted)',
                        fontWeight: isSaved ? 600 : 400,
                      }}
                    >
                      {isSaved ? '★ Saved' : '☆ Save'}
                    </button>
                  )}

                  <button
                    disabled={previewMode || !inStock}
                    onClick={() => handleAddToCart(item)}
                  >
                    {previewMode ? 'Preview Only'
                      : !inStock ? 'Out of Stock'
                      : justAdded ? '✓ Added!'
                      : inCart ? 'In Cart'
                      : 'Add to Cart'}
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
