import { useEffect, useState } from 'react';
import { getCatalog } from '../services/productService';
import { driverService } from '../services/driverService';
import type { Product } from '../types';

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [query, setQuery] = useState('laptop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------ Load Products ------------------ */

  const loadProducts = async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCatalog(searchTerm);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load catalog', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------ Load Points ------------------ */
  const loadPoints = async () => {
    try {
      const res = await driverService.getPoints();
      setPoints(res.current_points);
    } catch (err) {
      console.error('Failed to load driver points', err);
    }
  };

  /* ------------------ Effects ------------------ */
  useEffect(() => {
    loadPoints();
    loadProducts(query);
  }, []);

    /* ------------------ Search Handler ------------------ */
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadProducts(query);
  };


  /* ------------------ UI ------------------ */
  return (
    <div>
      <div className="points-banner">
        <h2>Your Available Points: {points}</h2>
      </div>

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
        <p>Loading products...</p>
      ) : (
        <div className="catalog-grid">
          {products.length === 0 ? (
            <p>No products found.</p>
          ) : (
            products.map((product) => (
              <div key={product.itemId} className="product-card">
                {product.image?.imageUrl ? (
                  <img src={product.image.imageUrl} alt={product.title} />
                ) : (
                  <div className="image-placeholder">No Image</div>
                )}

                <h3>{product.title || 'No Title'}</h3>

                <p>
                  {product.price?.value
                    ? `${product.price.value} ${product.price.currency}`
                    : 'Price N/A'}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}