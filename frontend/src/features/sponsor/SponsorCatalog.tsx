import { useEffect, useState } from 'react';
import { sponsorService } from '../../services/sponsorService';
import { api } from '../../services/apiClient';
import { getCatalog } from '../../services/productService';
import { Alert } from '../../components/Alert';
import type { Product } from '../../types';
import type { SponsorDriver } from '../../services/sponsorService';

interface SponsorCatalogItemRow {
  item_id: string;
  title: string;
  price_value: string | null;
  price_currency: string | null;
  points_cost?: number;
  image_url: string | null;
  stock_quantity?: number;
  is_active?: boolean;
}

function getCatalogImageAlt(title: string) {
  return `Catalog product image for ${title}`;
}

export function SponsorCatalog() {
  const SEARCH_PAGE_SIZE = 24;
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState<string>('laptop');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [searchTotal, setSearchTotal] = useState<number>(0);

  const [driverView, setDriverView] = useState<boolean>(false);
  const [drivers, setDrivers] = useState<SponsorDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  const [ratings, setRatings] = useState<Record<string, 'G' | 'PG'>>({});
  const [pointsCosts, setPointsCosts] = useState<Record<string, number>>({});
  const [dollarPerPoint, setDollarPerPoint] = useState<number>(0.01);

  /* ===================================================== */
  /* ================= LOAD EBAY ========================== */
  /* ===================================================== */

  const loadEbayProducts = async (search: string, page: number = 1) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await getCatalog(search, page, SEARCH_PAGE_SIZE);
      setProducts(data.items);
      setSearchPage(data.page);
      setSearchTotal(data.total);
    } catch {
      setError('Failed to search products.');
      setProducts([]);
      setSearchTotal(0);
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
    setSuccess(null);

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
        points_cost: item.points_cost ?? 0,
        stock_quantity: item.stock_quantity ?? 0,
      }));

      setProducts(items);
      setSearchTotal(0);
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
      setError('Failed to load sponsor drivers for preview mode.');
    }
  };

  useEffect(() => {
    loadEbayProducts(query);
    api.get<{ dollar_per_point: number }>('/api/sponsor/reward-defaults')
      .then(res => setDollarPerPoint(res.dollar_per_point || 0.01))
      .catch(() => {});
  }, []);

  /* ===================================================== */
  /* ================= SEARCH ============================ */
  /* ===================================================== */

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadEbayProducts(query, 1);
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
      await loadEbayProducts(query, 1);
    }
  };

  /* ===================================================== */
  /* ================= ADD TO CATALOG ==================== */
  /* ===================================================== */

  const handleAddToCatalog = async (product: Product) => {
    setError(null);
    setSuccess(null);
    const points_cost = pointsCosts[product.itemId] ?? 0;

    if (points_cost < 0) {
      setError('Point cost must be 0 or greater.');
      return;
    }

    try {
      await sponsorService.addToCatalog({
        ...product,
        rating: ratings[product.itemId] || 'G',
        points_cost,
      });

      setSuccess('Product added to catalog.');
    } catch {
      setError('Failed to add product.');
    }
  };

  /* ===================================================== */
  /* ================= REMOVE / DISABLE =================== */
  /* ===================================================== */

 const handleRemoveFromCatalog = async (itemId: string) => {
  setError(null);
  setSuccess(null);
  try {
    await sponsorService.disableProduct(itemId);

    // Refresh from database instead of mutating state manually
    await loadSponsorCatalog();
    setSuccess('Product disabled in sponsor catalog.');
  } catch {
    setError('Failed to disable product.');
  }
};

 const handleDeleteFromCatalog = async (itemId: string) => {
  setError(null);
  setSuccess(null);
  const confirmed = window.confirm('Remove this product from your catalog? This cannot be undone.');
  if (!confirmed) return;
  try {
    await sponsorService.removeFromCatalog(itemId);
    await loadSponsorCatalog();
    setSuccess('Product removed from catalog.');
  } catch {
    setError('Failed to remove product.');
  }
};

 const handleEnableProduct = async (itemId: string) => {
  setError(null);
  setSuccess(null);
  try {
    await sponsorService.enableProduct(itemId);
    await loadSponsorCatalog();
    setSuccess('Product enabled in sponsor catalog.');
  } catch {
    setError('Failed to enable product.');
  }
};

  /* ===================================================== */
  /* ================= PUBLISH =========================== */
  /* ===================================================== */

  const handlePublishCatalog = async () => {
    setError(null);
    setSuccess(null);
    try {
      await sponsorService.publishCatalog();
      setSuccess('Catalog published successfully.');
      await loadSponsorCatalog();
    } catch {
      setError('Failed to publish catalog.');
    }
  };

  /* ===================================================== */
  /* ================= UI ================================ */
  /* ===================================================== */

  const selectedDriver = drivers.find(d => d.driver_user_id === Number(selectedDriverId));
  const selectedDriverName = selectedDriver
    ? ((selectedDriver.first_name || selectedDriver.last_name)
      ? `${selectedDriver.first_name ?? ''} ${selectedDriver.last_name ?? ''}`.trim()
      : selectedDriver.username)
    : '';
  const totalPages = Math.max(1, Math.ceil(searchTotal / SEARCH_PAGE_SIZE));
  const canGoPrev = searchPage > 1;
  const canGoNext = searchPage < totalPages;

  return (
    <section className="catalog-page sponsor-catalog-container" aria-labelledby="sponsor-catalog-heading">
      <div className="catalog-shell">
        <div className="catalog-header card">
          <div>
            <p className="catalog-kicker">Sponsor Catalog</p>
            <h2 id="sponsor-catalog-heading">Manage the products your drivers can redeem.</h2>
            <p className="helper-text">
              Search products, curate your catalog, and preview what drivers will see.
            </p>
          </div>

          <div className="catalog-header-actions">
            {!driverView && (
              <button
                type="button"
                onClick={handlePublishCatalog}
                className="catalog-publish-button"
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
        </div>

        {driverView && (
          <div className="catalog-toolbar card">
            <div className="catalog-preview-panel">
              <div>
                <h3>Driver Preview Mode</h3>
                <p className="helper-text">Switch between drivers to verify the live catalog experience.</p>
              </div>
              <div className="catalog-preview-controls">
                <label htmlFor="preview-driver-select">Driver</label>
                <select
                  id="preview-driver-select"
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="catalog-select"
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
            </div>
            {selectedDriver && (
              <p className="catalog-muted-note">
                Available Points: {selectedDriver.points_balance.toLocaleString()} ({selectedDriverName})
              </p>
            )}
          </div>
        )}

        {!driverView && (
          <form onSubmit={handleSearch} className="catalog-toolbar card">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="catalog-search-input"
            />
            <button type="submit" className="catalog-primary-button">Search</button>
          </form>
        )}

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
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
                    alt={getCatalogImageAlt(product.title)}
                    className="catalog-product-image"
                  />
                ) : (
                  <div className="image-placeholder">
                    No Image
                  </div>
                )}

                <h3>{product.title}</h3>

                <p className="catalog-muted-note">
                  {product.price?.value
                    ? `${product.price.value} ${product.price.currency}`
                    : 'Price N/A'}
                </p>

                {product.stock_quantity !== undefined && (
                  <p className={`catalog-stock-badge ${
                    product.stock_quantity <= 0
                      ? 'out'
                      : product.stock_quantity <= 3
                        ? 'low'
                        : 'ok'
                  }`}>
                    {product.stock_quantity <= 0
                      ? 'Out of Stock'
                      : product.stock_quantity <= 3
                        ? `Only ${product.stock_quantity} left!`
                        : `${product.stock_quantity} in stock`}
                  </p>
                )}

                {product.is_active !== undefined && (
                  <p className={product.is_active ? 'catalog-status active' : 'catalog-status inactive'}>
                    {product.is_active
                      ? 'Status: Active'
                      : 'Status: Disabled'}
                  </p>
                )}

                {!driverView && (
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
                      className="catalog-select"
                    >
                      <option value="G">G</option>
                      <option value="PG">PG</option>
                    </select>

                    {product.price?.value && dollarPerPoint > 0 && (
                      <p className="catalog-muted-note" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        Recommended: {Math.round(parseFloat(product.price.value) / dollarPerPoint).toLocaleString()} pts
                      </p>
                    )}
                    <label
                      className="catalog-field"
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
                        className="catalog-cost-input"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handleAddToCatalog(product)}
                      className="catalog-primary-button"
                    >
                      Add to Catalog
                    </button>

                    {product.is_active !== undefined && (
                      <button
                        type="button"
                        className={product.is_active ? 'catalog-danger-button' : 'catalog-success-button'}
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
                        className="catalog-danger-button"
                        onClick={() => handleDeleteFromCatalog(product.itemId)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}

                {driverView && (
                  <div className="sponsor-actions" aria-label="Driver preview purchase status">
                    <p className="catalog-muted-note" style={{ marginBottom: 0 }}>
                      Points Cost: {(product.points_cost ?? 0).toLocaleString()}
                    </p>
                    {product.is_active === false ? (
                      <p className="catalog-status inactive" style={{ marginBottom: 0 }}>Unavailable (disabled in sponsor catalog)</p>
                    ) : (product.stock_quantity ?? 0) <= 0 ? (
                      <p className="catalog-status inactive" style={{ marginBottom: 0 }}>Unavailable (out of stock)</p>
                    ) : !selectedDriver ? (
                      <p className="catalog-muted-note" style={{ marginBottom: 0 }}>Select a driver to check eligibility</p>
                    ) : selectedDriver.points_balance >= (product.points_cost ?? 0) ? (
                      <p className="catalog-status active" style={{ marginBottom: 0 }}>Can redeem</p>
                    ) : (
                      <p className="catalog-status inactive" style={{ marginBottom: 0 }}>
                        Needs {Math.max(0, (product.points_cost ?? 0) - selectedDriver.points_balance).toLocaleString()} more points
                      </p>
                    )}
                  </div>
                )}
                </div>
              ))
            )}
          </div>
          {!driverView && searchTotal > SEARCH_PAGE_SIZE && (
            <div className="card mt-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="helper-text">
                Page {searchPage} of {totalPages} ({searchTotal.toLocaleString()} results)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="catalog-secondary-button"
                  onClick={() => loadEbayProducts(query, searchPage - 1)}
                  disabled={!canGoPrev}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="catalog-primary-button"
                  onClick={() => loadEbayProducts(query, searchPage + 1)}
                  disabled={!canGoNext}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </section>
  );
}
