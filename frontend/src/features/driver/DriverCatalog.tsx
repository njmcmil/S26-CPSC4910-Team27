import { useEffect, useState } from 'react';
import { driverService } from '../../services/driverService';
import { Button } from '../../components/Button';

interface CatalogItem {
  id: number;
  name: string;
  price_points: number;
}

export function DriverCatalogPage() {
  const [points, setPoints] = useState<number>(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      driverService.getPoints(),
      driverService.getCatalog(),
    ]).then(([pointsRes, catalogRes]) => {
      setPoints(pointsRes.points);
      setCatalog(catalogRes);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p>Loading catalog…</p>;
  }
  return (
    <section className="card" aria-labelledby="catalog-heading">
      <h2 id="catalog-heading">Sponsor Catalog</h2>
      <p className="mt-1">
        Browse available rewards from your sponsor's catalog and redeem your
        points.
      </p>
      <p className="placeholder-msg mt-2">
        Catalog browsing is under development. Check back soon.
      </p>
    </section>
  );
}
