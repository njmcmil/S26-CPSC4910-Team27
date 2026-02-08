import { useCallback, useEffect, useState } from 'react';
import { aboutService } from '../services/aboutService';
import { Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import type { AboutInfo, ApiError } from '../types';

export function AboutPage() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAbout = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await aboutService.getAbout();
      setInfo(data);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load About information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAbout();
  }, [fetchAbout]);

  if (loading) return <Spinner label="Loading project information..." />;

  if (error) {
    return (
      <section className="card" aria-labelledby="about-heading">
        <h2 id="about-heading">About</h2>
        <Alert variant="error">{error}</Alert>
        <div className="mt-2">
          <Button onClick={fetchAbout}>Retry</Button>
        </div>
      </section>
    );
  }

  if (!info) return null;

  return (
    <section className="card" aria-labelledby="about-heading">
      <h2 id="about-heading">About</h2>

      <dl className="about-dl mt-1">
        <div className="about-row">
          <dt>Product Name</dt>
          <dd>{info.product_name}</dd>
        </div>
        <div className="about-row">
          <dt>Description</dt>
          <dd>{info.product_description}</dd>
        </div>
        <div className="about-row">
          <dt>Team</dt>
          <dd>Team #{info.team_number}</dd>
        </div>
        <div className="about-row">
          <dt>Version</dt>
          <dd>{info.version_number}</dd>
        </div>
        <div className="about-row">
          <dt>Sprint</dt>
          <dd>Sprint {info.sprint_number}</dd>
        </div>
        <div className="about-row">
          <dt>Release Date</dt>
          <dd>{new Date(info.release_date).toLocaleDateString()}</dd>
        </div>
      </dl>
    </section>
  );
}
