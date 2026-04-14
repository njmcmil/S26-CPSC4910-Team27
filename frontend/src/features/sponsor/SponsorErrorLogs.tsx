import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';

interface ErrorLogEntry {
  error_id: number;
  occurred_at: string;
  operation: string;
  endpoint: string;
  error_message: string;
  status_code: number | null;
  request_id: string | null;
}

const OPERATION_LABELS: Record<string, string> = {
  ebay_search: 'eBay Search',
  ebay_product_detail: 'eBay Product Detail',
};

export function SponsorErrorLogs() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ errors: ErrorLogEntry[] }>('/api/sponsor/error-logs')
      .then(res => setErrors(res.errors))
      .catch(() => setFetchError('Failed to load error logs.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="card" aria-labelledby="error-logs-heading">
      <h2 id="error-logs-heading">Catalog API Error Log</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Failures from eBay catalog API calls. Use these to diagnose catalog update issues.
      </p>

      {fetchError && <p className="error">{fetchError}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : errors.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No API errors recorded. Everything looks healthy.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Time</th>
              <th style={{ padding: '8px' }}>Operation</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Error</th>
              <th style={{ padding: '8px' }}>Request ID</th>
            </tr>
          </thead>
          <tbody>
            {errors.map(entry => (
              <tr
                key={entry.error_id}
                style={{ borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }}
              >
                <td style={{ padding: '8px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                  {new Date(entry.occurred_at).toLocaleString()}
                </td>
                <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                  {OPERATION_LABELS[entry.operation] ?? entry.operation}
                </td>
                <td style={{ padding: '8px' }}>
                  {entry.status_code != null ? (
                    <span style={{
                      padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: '0.8rem',
                      background: entry.status_code >= 500 ? '#fee2e2' : '#fef3c7',
                      color:      entry.status_code >= 500 ? '#991b1b' : '#92400e',
                    }}>
                      {entry.status_code}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '8px', maxWidth: 420, wordBreak: 'break-word' }}>
                  {entry.error_message}
                </td>
                <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {entry.request_id ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
