import { useEffect, useState } from 'react';
import { getCatalog } from '../../services/productService';
import { driverService } from '../../services/driverService';
import type { Product } from '../../types';

export function SponsorCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState<string>('laptop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [driverView, setDriverView] = useState(false);
  const [points, setPoints] = useState<number>(0);

  /* -------------------------------------------- */
  /* Load Products */
  /* -------------------------------------------- */
  const loadProducts = async (search: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCatalog(search);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load catalog', err);
      setError('Failed to load catalog.');
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------- */
  /* Load Driver Points (For Preview Mode) */
  /* -------------------------------------------- */
  const loadPoints = async () => {
    try {
      const res = await driverService.getPoints();
      setPoints(res.current_points);
    } catch (err) {
      console.error('Failed to load points', err);
    }
  };

  /* -------------------------------------------- */
  /* Initial Load */
  /* -------------------------------------------- */
  useEffect(() => {
    loadProducts(query);
  }, []);

  /* -------------------------------------------- */
  /* Search */
  /* -------------------------------------------- */
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadProducts(query);
  };

  /* -------------------------------------------- */
  /* Toggle Driver Preview */
  /* -------------------------------------------- */
  const toggleDriverView = () => {
    if (!driverView) {
      loadPoints(); // Load points only when entering preview
    }
    setDriverView(!driverView);
  };

  /* -------------------------------------------- */
  /* UI */
  /* -------------------------------------------- */
  return (
    <div>
      <h2>Sponsor Catalog Management</h2>

      {/* Toggle Button */}
      <button onClick={toggleDriverView}>
        {driverView ? 'Exit Driver Preview' : 'View As Driver'}
      </button>

      {/* If Preview Mode → Show Points Banner */}
      {driverView && (
        <div className="points-banner">
          <h3>Driver Preview</h3>
          <p>Available Points: {points}</p>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
        />
        <button type="submit">Search</button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading catalog...</p>
      ) : (
        <div className="catalog-grid">
          {products.length === 0 ? (
            <p>No products found.</p>
          ) : (
            products.map((product) => (
              <div key={product.itemId} className="product-card">
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

                {/* Buttons ONLY show in real sponsor mode */}
                {!driverView && (
                  <div>
                    <button>Edit</button>
                    <button>Remove</button>
                  </div>
                )}

                {/* In Driver Preview — show disabled redeem */}
                {driverView && (
                  <button disabled>
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