import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/apiClient';
import { useCart } from '../../auth/CartContext';
import type { CartItem } from '../../auth/CartContext';
import { driverService, type DriverApplicationSponsor } from '../../services/driverService';

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

function getCatalogImageAlt(title: string) {
  return `Reward catalog image for ${title}`;
}

const DEBOUNCE_MS = 250;
const POLL_INTERVAL_MS = 30_000;

export function DriverCatalog({ previewMode = false }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [sponsors, setSponsors] = useState<DriverApplicationSponsor[]>([]);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const { addItem, items: cartItems, totalCount } = useCart();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const availableSponsors = sponsors.filter((sponsor) => sponsor.is_current_sponsor);
  const selectedSponsor = availableSponsors.find(
    (sponsor) => String(sponsor.sponsor_user_id) === selectedSponsorId,
  );

  const loadCatalog = async (silent = false) => {
    if (!selectedSponsorId) {
      setItems([]);
      setPoints(0);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      // US-38: returns current_points for balance check
      // US-39: returns stock_quantity per item
      const res = await api.get<{ current_points: number; items: CatalogItem[] }>(
        `/api/driver/catalog?sponsor_user_id=${selectedSponsorId}`
      );
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
    if (!selectedSponsorId) {
      setSavedIds(new Set());
      return;
    }
    try {
      const res = await api.get<{ saved_item_ids: string[] }>(
        `/api/driver/saved-products?sponsor_user_id=${selectedSponsorId}`,
      );
      setSavedIds(new Set(res.saved_item_ids));
    } catch {
      // silently fail- save buttons just won't reflect server state
    }
  };

  useEffect(() => {
    if (previewMode) return;

    driverService.getApplicationSponsors()
      .then((res) => {
        const currentSponsors = res.filter((sponsor) => sponsor.is_current_sponsor);
        setSponsors(currentSponsors);

        const requestedSponsorId = searchParams.get('sponsor_user_id');
        const initialSponsorId =
          requestedSponsorId && currentSponsors.some((s) => String(s.sponsor_user_id) === requestedSponsorId)
            ? requestedSponsorId
            : currentSponsors[0]
              ? String(currentSponsors[0].sponsor_user_id)
              : '';

        setSelectedSponsorId(initialSponsorId);
      })
      .catch(() => {});
  }, [previewMode, searchParams]);

  useEffect(() => {
    if (previewMode || !selectedSponsorId) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sponsor_user_id', selectedSponsorId);
      return next;
    }, { replace: true });

    loadCatalog();
    loadSaved();
    pollRef.current = setInterval(() => loadCatalog(true), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [previewMode, selectedSponsorId]);

  const toggleSave = async (item_id: string) => {
    if (!selectedSponsorId) return;
    const alreadySaved = savedIds.has(item_id);
    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev);
      alreadySaved ? next.delete(item_id) : next.add(item_id);
      return next;
    });
    try {
      if (alreadySaved) {
        await api.delete(`/api/driver/saved-products/${item_id}?sponsor_user_id=${selectedSponsorId}`);
      } else {
        await api.post('/api/driver/saved-products', {
          item_id,
          sponsor_user_id: Number(selectedSponsorId),
        });
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
    if (!selectedSponsorId || !selectedSponsor) return;
    if (previewMode) return;
    setFeedback(null);

    const alreadyInCart = cartItems.some(
      i => i.item_id === item.item_id && i.sponsor_user_id === Number(selectedSponsorId),
    );
    if (alreadyInCart) {
      setFeedback({ type: 'error', msg: `'${item.title}' is already in your cart.` });
      return;
    }

    const otherSponsorItems = cartItems.filter(
      (cartItem) => cartItem.sponsor_user_id !== Number(selectedSponsorId),
    );
    if (otherSponsorItems.length > 0) {
      setFeedback({
        type: 'error',
        msg: `Your cart currently contains items from ${otherSponsorItems[0].sponsor_name}. Please check out or clear the cart before shopping a different sponsor catalog.`,
      });
      return;
    }

    const cartItem: Omit<CartItem, 'quantity'> = {
      item_id: item.item_id,
      sponsor_user_id: Number(selectedSponsorId),
      sponsor_name: selectedSponsor.sponsor_name,
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

  const isInCart = (item_id: string) =>
    cartItems.some(
      i => i.item_id === item_id && i.sponsor_user_id === Number(selectedSponsorId),
    );

  return (
    <section className="catalog-page" aria-labelledby="driver-catalog-heading">
      <div className="catalog-shell">
        <div className="catalog-header card">
          <div>
            <p className="catalog-kicker">Driver Catalog</p>
            <h2 id="driver-catalog-heading">Redeem rewards from your sponsor catalog.</h2>
            <p className="helper-text">
              Browse available products, check stock, and save items for later.
            </p>
          </div>

          <div className="catalog-summary">
            <span className="catalog-summary-label">Available Points</span>
            <strong className="catalog-summary-value">{points.toLocaleString()}</strong>
          </div>

          {!previewMode && (
            <button
              onClick={() => navigate('/driver/cart')}
              className="catalog-cart-button"
              type="button"
            >
              View Cart
              <span className="catalog-cart-badge">{totalCount}</span>
            </button>
          )}

          {previewMode && (
            <p className="helper-text">Sponsor Preview. Cart actions are disabled.</p>
          )}
        </div>
      
        {!previewMode && (
          <div className="catalog-toolbar card">
            <select
              value={selectedSponsorId}
              onChange={(e) => setSelectedSponsorId(e.target.value)}
              aria-label="Select sponsor catalog"
              className="catalog-select"
            >
              {availableSponsors.length === 0 ? (
                <option value="">No sponsor catalogs available</option>
              ) : (
                availableSponsors.map((sponsor) => (
                  <option key={sponsor.sponsor_user_id} value={sponsor.sponsor_user_id}>
                    {sponsor.sponsor_name}
                  </option>
                ))
              )}
            </select>
            <input
              type="search"
              placeholder="Search catalog…"
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              aria-label="Search catalog"
              className="catalog-search-input"
            />
          </div>
        )}

        {feedback && (
          <div
            role="alert"
            className={feedback.type === 'success' ? 'catalog-feedback success' : 'catalog-feedback error'}
          >
            {feedback.msg}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p>Loading catalog...</p>
        ) : !previewMode && availableSponsors.length === 0 ? (
          <p>No active sponsor catalogs are available for your account yet.</p>
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
                const stockClass = !inStock ? 'out' : item.stock_quantity <= 3 ? 'low' : 'ok';
                const detailPath = `/driver/catalog/${item.item_id}?sponsor_user_id=${selectedSponsorId}`;
                const purchaseChecks = [
                  { label: 'Enough points', met: canAfford },
                  { label: 'Item in stock', met: inStock },
                  { label: 'Not already in cart', met: !inCart },
                ];

                return (
                  <div key={item.item_id} className="product-card">
                    {!previewMode ? (
                      <Link to={detailPath} className="catalog-image-link">
                        {item.image_url ? (
                          <img src={item.image_url} alt={getCatalogImageAlt(item.title)} className="catalog-product-image" />
                        ) : (
                          <div className="image-placeholder">No Image</div>
                        )}
                      </Link>
                    ) : item.image_url ? (
                      <img src={item.image_url} alt={getCatalogImageAlt(item.title)} className="catalog-product-image" />
                    ) : (
                      <div className="image-placeholder">No Image</div>
                    )}

                    {!previewMode ? (
                      <Link to={detailPath} className="catalog-title-link">
                        <h3>{item.title}</h3>
                      </Link>
                    ) : (
                      <h3>{item.title}</h3>
                    )}

                    <p className="catalog-product-price">{item.points_cost.toLocaleString()} pts</p>

                    <p className={`catalog-stock-badge ${stockClass}`}>
                      {!inStock
                        ? 'Out of Stock'
                        : item.stock_quantity <= 3
                          ? `Only ${item.stock_quantity} left`
                          : `${item.stock_quantity} in stock`}
                    </p>

                    {!previewMode && !canAfford && inStock && (
                      <p className="catalog-muted-note">
                        Need {(item.points_cost - points).toLocaleString()} more pts
                      </p>
                    )}

                    {!previewMode && (
                      <div className="catalog-status-checker" aria-label={`Purchase status for ${item.title}`}>
                        {purchaseChecks.map((check) => (
                          <div
                            key={check.label}
                            className={`catalog-status-row ${check.met ? 'met' : 'blocked'}`}
                          >
                            <span aria-hidden="true" className="catalog-status-icon">
                              {check.met ? '✓' : '✕'}
                            </span>
                            <span>{check.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!previewMode && (
                      <Link
                        to={detailPath}
                        className="catalog-link"
                      >
                        View Details
                      </Link>
                    )}

                    {!previewMode && (
                      <button
                        type="button"
                        onClick={() => toggleSave(item.item_id)}
                        className={isSaved ? 'catalog-secondary-button active' : 'catalog-secondary-button'}
                      >
                        {isSaved ? 'Saved' : 'Save'}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={previewMode || !inStock}
                      onClick={() => handleAddToCart(item)}
                      className="catalog-primary-button"
                    >
                      {previewMode ? 'Preview Only'
                        : !inStock ? 'Out of Stock'
                        : justAdded ? 'Added'
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
    </section>
  );
}
