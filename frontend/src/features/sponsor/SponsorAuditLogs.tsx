import { useEffect, useState } from 'react';
import { sponsorService, type SponsorUserActionLog } from '../../services/sponsorService';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';

export function SponsorAuditLogs() {
  const [logs, setLogs] = useState<SponsorUserActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    sponsorService
      .getUserActionLogs()
      .then(setLogs)
      .catch(() => setFetchError('Failed to load sponsor activity logs.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="card" aria-labelledby="sponsor-audit-logs-heading">
      <h2 id="sponsor-audit-logs-heading">Sponsor User Activity Log</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Review sponsor user actions from newest to oldest for compliance and internal accountability.
      </p>

      {fetchError && <Alert variant="error">{fetchError}</Alert>}

      {loading ? (
        <Spinner label="Loading sponsor activity logs..." />
      ) : logs.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No sponsor user activity has been recorded yet.</p>
      ) : (
        <table className="devices-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>User ID</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((entry, index) => (
              <tr key={`${entry.date}-${entry.changed_by_user_id ?? 'unknown'}-${index}`}>
                <td>{new Date(entry.date).toLocaleString()}</td>
                <td>{entry.changed_by_username ?? 'Unknown User'}</td>
                <td>{entry.changed_by_user_id ?? '\u2014'}</td>
                <td>{entry.reason ?? '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
