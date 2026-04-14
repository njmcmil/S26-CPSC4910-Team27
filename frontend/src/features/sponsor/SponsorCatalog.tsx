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
  points_cost?: number;
  image_url: string | null;
  stock_quantity?: number;
  is_active?: boolean;
}

function getCatalogImageAlt(title: string) {
  return `Catalog product image for ${title}`;
}

export function SponsorCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState<string>('laptop');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [driverView, setDriverView] = useState<boolean>(false);
  const [drivers, setDrivers] = useState<SponsorDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

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
        points_cost: item.points_cost ?? 0,
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
        )}
      </div>
    </section>
  );
}
