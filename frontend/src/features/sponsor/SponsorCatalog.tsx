import { useEffect, useState } from 'react';
import { sponsorService } from '../../services/sponsorService';
import { getCatalog } from '../../services/productService';
import type { Product } from '../../types';
import type { SponsorDriver } from '../../services/sponsorService';

interface SponsorCatalogItemRow {
  item_id: string;
  title: string;
  price_value: string | null;
  price_currency: string | null;
  image_url: string | null;
  stock_quantity?: number;
  is_active?: boolean;
}

export function SponsorCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState<string>('laptop');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [driverView, setDriverView] = useState<boolean>(false);
  const [drivers, setDrivers] = useState<SponsorDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);
  const [purchaseToast, setPurchaseToast] = useState<string | null>(null);

  const [ratings, setRatings] = useState<Record<string, 'G' | 'PG'>>({});
  const [pointsCosts, setPointsCosts] = useState<Record<string, number>>({});

  /* ===================================================== */
  /* ================= LOAD EBAY ========================== */
  /* ===================================================== */

  const loadEbayProducts = async (search: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCatalog(search);
      setProducts(data);
    } catch {
      setError('Failed to search products.');
    } finally {
      setLoading(false);
    }
  };

  /* ===================================================== */
  /* ================= LOAD SPONSOR ======================= */
  /* ===================================================== */

  const loadSponsorCatalog = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await sponsorService.getCatalog();

      const rawItems: SponsorCatalogItemRow[] = Array.isArray(res) ? res : res.items ?? [];
      const items: Product[] = rawItems.map((item) => ({
        itemId: item.item_id,
        title: item.title,
        price: item.price_value
          ? {
              value: item.price_value,
              currency: item.price_currency ?? undefined,
            }
          : undefined,
        image: item.image_url
          ? {
              imageUrl: item.image_url,
            }
          : undefined,
        is_active: item.is_active,
        stock_quantity: item.stock_quantity ?? 0,
      }));

      setProducts(items);
    } catch {
      setError('Failed to load sponsor catalog.');
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      const res = await sponsorService.getDrivers();
      setDrivers(res);
      if (!selectedDriverId && res.length > 0) {
        setSelectedDriverId(String(res[0].driver_user_id));
      }
    } catch {
      console.error('Failed to load sponsor drivers');
    }
  };

  useEffect(() => {
    loadEbayProducts(query);
  }, []);

  /* ===================================================== */
  /* ================= SEARCH ============================ */
  /* ===================================================== */

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadEbayProducts(query);
  };

  /* ===================================================== */
  /* ================= TOGGLE VIEW ======================= */
  /* ===================================================== */

  const toggleDriverView = async () => {
    const next = !driverView;
    setDriverView(next);

    if (next) {
      // entering preview
      await loadSponsorCatalog();
      await loadDrivers();
    } else {
      // back to sponsor mode
      await loadEbayProducts(query);
    }
  };

  /* ===================================================== */
  /* ================= ADD TO CATALOG ==================== */
  /* ===================================================== */

  const handleAddToCatalog = async (product: Product) => {
    const points_cost = pointsCosts[product.itemId] ?? 0;

    if (points_cost < 0) {
      alert('Point cost must be 0 or greater');
      return;
    }

    try {
      await sponsorService.addToCatalog({
        ...product,
        rating: ratings[product.itemId] || 'G',
        points_cost,
      });

      alert('Product added to catalog!');
    } catch {
      alert('Failed to add product.');
    }
  };

  /* ===================================================== */
  /* ================= REMOVE / DISABLE =================== */
  /* ===================================================== */

 const handleRemoveFromCatalog = async (itemId: string) => {
  try {
    await sponsorService.disableProduct(itemId);

    // Refresh from database instead of mutating state manually
    await loadSponsorCatalog();
  } catch {
    alert("Failed to disable product.");
  }
};

 const handleDeleteFromCatalog = async (itemId: string) => {
  const confirmed = window.confirm('Remove this product from your catalog? This cannot be undone.');
  if (!confirmed) return;
  try {
    await sponsorService.removeFromCatalog(itemId);
    await loadSponsorCatalog();
  } catch {
    alert('Failed to remove product.');
  }
};

 const handleEnableProduct = async (itemId: string) => {
  try {
    await sponsorService.enableProduct(itemId);
    await loadSponsorCatalog();
  } catch {
    alert('Failed to enable product.');
  }
};

  const handleSponsorPurchase = async (itemId: string, title: string) => {
  if (!selectedDriverId) {
    alert('Select a driver first.');
    return;
  }
    try {
      setPurchasingItemId(itemId);
      const res = await sponsorService.purchaseForDriver(itemId, Number(selectedDriverId)) as {
        message: string;
        driver_new_points_balance: number;
      };
    setPurchaseToast(`${res.message}. New driver balance: ${res.driver_new_points_balance} pts.`);
    await loadSponsorCatalog();
    await loadDrivers();
  } catch (err: any) {
    const detail = err?.detail ?? err?.message ?? `Failed to purchase '${title}' for driver.`;
    alert(detail);
  } finally {
    setPurchasingItemId(null);
  }
};

  /* ===================================================== */
  /* ================= PUBLISH =========================== */
  /* ===================================================== */

  const handlePublishCatalog = async () => {
    try {
      await sponsorService.publishCatalog();
      alert('Catalog Published Successfully!');
      await loadSponsorCatalog();
    } catch {
      alert('Failed to publish catalog.');
    }
  };

  useEffect(() => {
    if (!purchaseToast) return;
    const t = setTimeout(() => setPurchaseToast(null), 3000);
    return () => clearTimeout(t);
  }, [purchaseToast]);

  /* ===================================================== */
  /* ================= UI ================================ */
  /* ===================================================== */

  const selectedDriver = drivers.find(d => d.driver_user_id === Number(selectedDriverId));
  const selectedDriverName = selectedDriver
    ? ((selectedDriver.first_name || selectedDriver.last_name)
      ? `${selectedDriver.first_name ?? ''} ${selectedDriver.last_name ?? ''}`.trim()
      : selectedDriver.username)
    : '';

  return (
    <div className="sponsor-catalog-container">
      <h2>Sponsor Catalog Management</h2>

      {/* HEADER */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {!driverView && (
          <button
            type="button"
            onClick={handlePublishCatalog}
            style={{
              background: '#16a34a',
              color: 'white',
              padding: '6px 12px',
            }}
          >
            Publish Catalog
          </button>
        )}

        <button
          type="button"
          onClick={toggleDriverView}
          className="preview-toggle-btn"
        >
          {driverView ? 'Exit Driver Preview' : 'View As Driver'}
        </button>
      </div>

      {driverView && (
        <div className="points-banner">
          <h3>Driver Preview Mode</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="preview-driver-select">Driver:</label>
            <select
              id="preview-driver-select"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              style={{ padding: '4px 8px' }}
            >
              <option value="">-- Select driver --</option>
              {drivers.map((d) => {
                const name = (d.first_name || d.last_name)
                  ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim()
                  : d.username;
                return (
                  <option key={d.driver_user_id} value={d.driver_user_id}>
                    {name} ({d.points_balance.toLocaleString()} pts)
                  </option>
                );
              })}
            </select>
          </div>
          {selectedDriver && (
            <p style={{ marginTop: '0.4rem' }}>
              Available Points: {selectedDriver.points_balance.toLocaleString()} ({selectedDriverName})
            </p>
          )}
        </div>
      )}

      {!driverView && (
        <form onSubmit={handleSearch} className="search-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
          />
          <button type="submit">Search</button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="catalog-grid">
          {products.length === 0 ? (
            <p>No products found.</p>
          ) : (
            products.map((product) => (
              <div
                key={product.itemId}
                className="product-card"
              >
                {/* IMAGE */}
                {product.image?.imageUrl ? (
                  <img
                    src={product.image.imageUrl}
                    alt={product.title}
                  />
                ) : (
                  <div className="image-placeholder">
                    No Image
                  </div>
                )}

                <h3>{product.title}</h3>

                <p>
                  {product.price?.value
                    ? `${product.price.value} ${product.price.currency}`
                    : 'Price N/A'}
                </p>

                {product.stock_quantity !== undefined && (
                  <p style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    marginBottom: '0.5rem',
                    color: product.stock_quantity <= 0
                      ? '#b91c1c'
                      : product.stock_quantity <= 3
                        ? '#92400e'
                        : '#065f46',
                    background: product.stock_quantity <= 0
                      ? '#fee2e2'
                      : product.stock_quantity <= 3
                        ? '#fef3c7'
                        : '#d1fae5',
                  }}>
                    {product.stock_quantity <= 0
                      ? 'Out of Stock'
                      : product.stock_quantity <= 3
                        ? `Only ${product.stock_quantity} left!`
                        : `${product.stock_quantity} in stock`}
                  </p>
                )}

                {product.is_active !== undefined && (
                  <p
                    style={{
                      fontWeight: 'bold',
                      color: product.is_active ? 'green' : 'red',
                    }}
                  >
                    {product.is_active
                      ? 'Status: Active 🟢'
                      : 'Status: Disabled 🔴'}
                  </p>
                )}

                {/* ========================================= */}
                {/* Sponsor Controls (Visible In Both Modes) */}
                {/* ========================================= */}

                <div className="sponsor-actions">

                  <select
                    value={ratings[product.itemId] || 'G'}
                    onChange={(e) =>
                      setRatings({
                        ...ratings,
                        [product.itemId]:
                          e.target.value as 'G' | 'PG',
                      })
                    }
                  >
                    <option value="G">G</option>
                    <option value="PG">PG</option>
                  </select>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      fontSize: '0.82rem',
                    }}
                  >
                    Point Cost
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={pointsCosts[product.itemId] ?? 0}
                      onChange={(e) =>
                        setPointsCosts((prev) => ({
                          ...prev,
                          [product.itemId]: Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0
                          ),
                        }))
                      }
                      style={{
                        width: '90px',
                        padding: '2px 6px',
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleAddToCatalog(product)}
                  >
                    Add to Catalog
                  </button>

                  {product.is_active !== undefined && (
                    <button
                      type="button"
                      style={{
                        background: product.is_active ? 'red' : '#16a34a',
                        color: 'white',
                        marginLeft: '0.5rem',
                      }}
                      onClick={() =>
                        product.is_active
                          ? handleRemoveFromCatalog(product.itemId)
                          : handleEnableProduct(product.itemId)
                      }
                    >
                      {product.is_active ? 'Disable' : 'Enable'}
                    </button>
                  )}

                  {product.is_active !== undefined && (
                    <button
                      type="button"
                      style={{
                        background: '#7f1d1d',
                        color: 'white',
                        marginLeft: '0.5rem',
                      }}
                      onClick={() => handleDeleteFromCatalog(product.itemId)}
                    >
                      Remove
                    </button>
                  )}

                  {driverView && product.is_active !== undefined && (
                    <button
                      type="button"
                      style={{
                        background: '#2563eb',
                        color: 'white',
                        marginLeft: '0.5rem',
                      }}
                      disabled={!selectedDriverId || purchasingItemId === product.itemId || (product.stock_quantity ?? 0) <= 0}
                      onClick={() => handleSponsorPurchase(product.itemId, product.title)}
                    >
                      {purchasingItemId === product.itemId ? 'Purchasing...' : 'Purchase for Driver'}
                    </button>
                  )}
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {purchaseToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: '1rem',
            bottom: '1rem',
            background: '#065f46',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
            maxWidth: 420,
            zIndex: 1200,
            fontSize: '0.9rem',
          }}
        >
          {purchaseToast}
        </div>
      )}
    </div>
  );
}
