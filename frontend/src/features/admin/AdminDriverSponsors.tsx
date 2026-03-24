import { useState } from 'react';
import { api } from '../../services/apiClient'
interface SponsorSummary {
  id: number;
  name: string;
}

export function AdminDriverSponsorsPage() {
  const [driverIdInput, setDriverIdInput] = useState('');
  const [sponsors, setSponsors] = useState<SponsorSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchSponsors() {
    const id = parseInt(driverIdInput, 10);
    if (!id || id <= 0) {
      setError('Please enter a valid numeric driver ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setSponsors(null);
    try {
      const data = await api.get<SponsorSummary[]>(`/admin/drivers/${id}/sponsors`);
      setSponsors(data);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to fetch sponsors.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card" aria-labelledby="driver-sponsors-heading">
      <h2 id="driver-sponsors-heading">Driver Sponsors Lookup</h2>
      <p className="mt-1">Enter a driver ID to view all sponsors associated with that driver.</p>

      <div className="mt-2" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="number"
          min={1}
          placeholder="Driver ID"
          value={driverIdInput}
          onChange={(e) => setDriverIdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchSponsors()}
          style={{ padding: '0.4rem 0.6rem', width: '140px' }}
          aria-label="Driver ID"
        />
        <button onClick={fetchSponsors} disabled={loading}>
          {loading ? 'Loading…' : 'Fetch Sponsors'}
        </button>
      </div>

      {error && (
        <p className="mt-2" style={{ color: 'var(--color-error, red)' }} role="alert">
          {error}
        </p>
      )}

      {sponsors !== null && (
        <div className="mt-2">
          {sponsors.length === 0 ? (
            <p>No sponsors found for this driver.</p>
          ) : (
            <ul>
              {sponsors.map((s) => (
                <li key={s.id}>
                  <strong>{s.name}</strong> <span style={{ color: '#888' }}>(ID: {s.id})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

