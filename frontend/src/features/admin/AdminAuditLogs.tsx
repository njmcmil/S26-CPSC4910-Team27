import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { ApiError } from '../../types';

interface AuditLogRow {
  date: string;
  category: string;
  sponsor_id: number | null;
  sponsor_name: string | null;
  driver_id: number | null;
  points_changed: number | null;
  reason: string | null;
  changed_by_user_id: number | null;
}

interface AuditLogResponse {
  audit_logs: AuditLogRow[];
}

export function AdminAuditLogsPage() {
  const [category, setCategory] = useState('sponsor_user_action');
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async (nextCategory = category) => {
    setLoading(true);
    setError('');
    try {
      const qs = nextCategory ? `?category=${encodeURIComponent(nextCategory)}` : '';
      const data = await api.get<AuditLogResponse>(`/admin/audit-logs${qs}`);
      setLogs(data.audit_logs);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <section className="card" aria-labelledby="audit-heading">
      <h2 id="audit-heading">Audit Logs</h2>
      <p className="mt-1">
        Review recent system audit activity. Sponsor user actions are selected by default for compliance checks.
      </p>

      <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
          <label htmlFor="audit-category">Category</label>
          <select
            id="audit-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="sponsor_user_action">Sponsor User Actions</option>
            <option value="point_change">Point Changes</option>
            <option value="driver_status_change">Driver Status Changes</option>
            <option value="">All Categories</option>
          </select>
        </div>
        <Button type="button" onClick={() => loadLogs(category)} disabled={loading}>
          Refresh Logs
        </Button>
      </div>

      {loading ? (
        <Spinner label="Loading audit logs..." />
      ) : error ? (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : logs.length === 0 ? (
        <p className="placeholder-msg mt-2">No audit log entries matched the selected category.</p>
      ) : (
        <div className="card mt-2" style={{ overflowX: 'auto' }}>
          <table className="devices-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Sponsor</th>
                <th>Driver ID</th>
                <th>Points</th>
                <th>Reason</th>
                <th>Changed By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={`${log.date}-${log.category}-${index}`}>
                  <td>{new Date(log.date).toLocaleString()}</td>
                  <td>{log.category}</td>
                  <td>{log.sponsor_name || (log.sponsor_id != null ? `Sponsor #${log.sponsor_id}` : '\u2014')}</td>
                  <td>{log.driver_id ?? '\u2014'}</td>
                  <td>{log.points_changed ?? '\u2014'}</td>
                  <td>{log.reason || '\u2014'}</td>
                  <td>{log.changed_by_user_id ?? '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
