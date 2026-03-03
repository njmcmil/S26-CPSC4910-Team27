import { useEffect, useState } from 'react';
import { driverService } from '../../services/driverService';
import { sponsorService } from '../../services/sponsorService';
import { getCatalog } from '../../services/productService';
import type { Product } from '../../types';

export function SponsorCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState<string>('laptop');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [driverView, setDriverView] = useState<boolean>(false);
  const [points, setPoints] = useState<number>(0);

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

      const items = Array.isArray(res) ? res : res.items ?? [];

      setProducts(items);
    } catch {
      setError('Failed to load sponsor catalog.');
    } finally {
      setLoading(false);
    }
  };

  const loadPoints = async () => {
    try {
      const res = await driverService.getPoints();
      setPoints(res.current_points);
    } catch {
      console.error('Failed to load points');
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
      await loadPoints();
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
          <p>Available Points: {points}</p>
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

                  <button
                    type="button"
                    style={{
                      background: 'red',
                      color: 'white',
                      marginLeft: '0.5rem',
                    }}
                    onClick={() =>
                      handleRemoveFromCatalog(product.itemId)
                    }
                  >
                    Disable
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}