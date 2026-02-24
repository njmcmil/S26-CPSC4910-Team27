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

  // Store rating without mutating product object
  const [ratings, setRatings] = useState<Record<string, 'G' | 'PG'>>({});

  /* ===================================================== */
  /* =============== LOAD EBAY SEARCH (Sponsor Mode) ===== */
  /* ===================================================== */

  const loadEbayProducts = async (search: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCatalog(search);
      setProducts(data);
    } catch (err) {
      console.error('Failed to search eBay', err);
      setError('Failed to search products.');
    } finally {
      setLoading(false);
    }
  };

  /* ===================================================== */
  /* =============== LOAD SPONSOR TABLE (Driver Preview) == */
  /* ===================================================== */

  const loadSponsorCatalog = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await sponsorService.getCatalog();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load sponsor catalog', err);
      setError('Failed to load sponsor catalog.');
    } finally {
      setLoading(false);
    }
  };

  /* ===================================================== */
  /* =============== LOAD DRIVER POINTS =================== */
  /* ===================================================== */

  const loadPoints = async () => {
    try {
      const res = await driverService.getPoints();
      setPoints(res.current_points);
    } catch (err) {
      console.error('Failed to load points', err);
    }
  };

  /* ===================================================== */
  /* =============== INITIAL LOAD ========================= */
  /* ===================================================== */

  useEffect(() => {
    loadEbayProducts(query);
  }, []);

  /* ===================================================== */
  /* =============== SEARCH =============================== */
  /* ===================================================== */

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadEbayProducts(query);
  };

  /* ===================================================== */
  /* =============== TOGGLE PREVIEW ======================= */
  /* ===================================================== */

  const toggleDriverView = () => {
    setDriverView(prev => !prev);

    // When entering preview → load DB table
    if (!driverView) {
      loadSponsorCatalog();
      loadPoints();
    }
  };

  /* ===================================================== */
  /* =============== ADD TO SPONSOR TABLE ================ */
  /* ===================================================== */

  const handleAddToCatalog = async (product: Product) => {
    try {
      await sponsorService.addToCatalog({
        ...product,
        rating: ratings[product.itemId] || 'G',
      });

      alert('Product added to sponsor catalog!');
    } catch (err) {
      console.error('Failed to add product', err);
      alert('Failed to add product.');
    }
  };

  /* ===================================================== */
  /* ======================= UI ========================== */
  /* ===================================================== */

  return (
    <div className="sponsor-catalog-container">
      <h2>Sponsor Catalog Management</h2>

      {/* Toggle Preview */}
      <button onClick={toggleDriverView} className="preview-toggle-btn">
        {driverView ? 'Exit Driver Preview' : 'View As Driver'}
      </button>

      {/* Driver Preview Banner */}
      {driverView && (
        <div className="points-banner">
          <h3>Driver Preview Mode</h3>
          <p>Available Points: {points}</p>
        </div>
      )}

      {/* Search only in Sponsor Mode */}
      {!driverView && (
        <form onSubmit={handleSearch} className="search-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search eBay products..."
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
              <div key={product.itemId} className="product-card">

                {/* Image */}
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

                {/* Title */}
                <h3>{product.title}</h3>

                {/* Price */}
                <p>
                  {product.price?.value
                    ? `${product.price.value} ${product.price.currency}`
                    : 'Price N/A'}
                </p>

                {/* ================= Sponsor Mode ================= */}
                {!driverView && (
                  <div className="sponsor-actions">

                    {/* Rating Selector */}
                    <select
                      value={ratings[product.itemId] || 'G'}
                      onChange={(e) =>
                        setRatings({
                          ...ratings,
                          [product.itemId]: e.target.value as 'G' | 'PG',
                        })
                      }
                    >
                      <option value="G">G</option>
                      <option value="PG">PG</option>
                    </select>

                    <button onClick={() => handleAddToCatalog(product)}>
                      Add to Catalog
                    </button>

                  </div>
                )}

                {/* ================= Driver Preview ================= */}
                {driverView && (
                  <button disabled className="preview-redeem-btn">
                    Preview: Redeem Disabled
                  </button>
                )}

              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}