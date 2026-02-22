import { useEffect, useState } from 'react';
import { getCatalog } from '../services/productService';
import type { Product } from '../types';

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('laptop'); // default search
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCatalog(searchTerm);
      console.log('Catalog data:', data);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load catalog', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load default products on mount
  useEffect(() => {
    loadProducts(query);
  }, []);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadProducts(query);
  };

  return (
    <div>
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
        />
        <button type="submit">Search</button>
      </form>

      {/* Error Message */}
      {error && <p className="error">{error}</p>}

      {/* Loading State */}
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