import { useEffect, useState } from 'react';
import { driverService } from '../../services/driverService';
import { sponsorService } from '../../services/sponsorService';
import type { Product } from '../../types';

interface Props {
  previewMode?: boolean;
}

export function DriverCatalog({ previewMode = false }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /* -------------------------------- */
  /* Load Sponsor Catalog */
  /* -------------------------------- */
  const loadCatalog = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await sponsorService.getCatalog();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load sponsor catalog', err);
      setError('Failed to load catalog.');
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------- */
  /* Load Points */
  /* -------------------------------- */
  const loadPoints = async () => {
    try {
      const res = await driverService.getPoints();
      setPoints(res.current_points);
    } catch (err) {
      console.error('Failed to load points', err);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadPoints();
  }, []);

  /* -------------------------------- */
  /* Redeem */
  /* -------------------------------- */
  const handleRedeem = (product: Product) => {
    if (previewMode) return;

    console.log('Redeem:', product.itemId);
    // TODO: Call redeem API
  };

  return (
    <div>
      <div className="points-banner">
        <h2>Your Available Points: {points}</h2>

        {previewMode && (
          <p className="text-sm text-gray-500">
            Sponsor Preview — Purchase Disabled
          </p>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading catalog...</p>
      ) : (
        <div className="catalog-grid">
          {products.length === 0 ? (
            <p>No sponsor products available.</p>
          ) : (
            products.map((product) => (
              <div key={product.itemId} className="product-card">
                <h3>{product.title}</h3>

                <p>
                  {product.price?.value
                    ? `${product.price.value} ${product.price.currency}`
                    : 'Price N/A'}
                </p>

                {product.image?.imageUrl ? (
                  <img
                    src={product.image.imageUrl}
                    alt={product.title}
                  />
                ) : (
                  <div className="image-placeholder">No Image</div>
                )}

                <button
                  disabled={previewMode}
                  onClick={() => handleRedeem(product)}
                >
                  {previewMode ? 'Preview Only' : 'Redeem'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}