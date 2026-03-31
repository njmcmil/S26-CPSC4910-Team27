import { useState } from 'react';
import { api } from '../../services/apiClient'

interface DriverSponsorRow {
  id: number;
  name: string;
  status: string | null;
  total_points: number;
}

export function AdminDriverSponsorsPage() {
  const [driverIdInput, setDriverIdInput] = useState('');
  const [sponsors, setSponsors] = useState<DriverSponsorRow[] | null>(null);
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
      const data = await api.get<DriverSponsorRow[]>(`/admin/drivers/${id}/sponsors`);
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
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={thStyle}>Sponsor Name</th>
                  <th style={thStyle}>Sponsor ID</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Points Balance</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={tdStyle}>{s.id}</td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(s.status)}>
                        {s.status ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {s.total_points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            {sponsors.length} sponsor{sponsors.length !== 1 ? 's' : ''} found for driver ID {driverIdInput}.
          </p>
        </div>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
};

function statusBadgeStyle(status: string | null): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: '9999px',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'capitalize',
  };
  if (status === 'active') return { ...base, background: '#dcfce7', color: '#166534' };
  if (status === 'inactive') return { ...base, background: '#fee2e2', color: '#991b1b' };
  return { ...base, background: '#f3f4f6', color: '#374151' };
}

