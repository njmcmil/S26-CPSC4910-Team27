import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { ApiError } from '../../types';

interface CommunicationLogRow {
  log_id: number;
  created_at: string;
  driver_user_id: number;
  driver_name: string | null;
  sponsor_user_id: number;
  sponsor_name: string | null;
  sent_by_role: 'driver' | 'sponsor';
  message: string;
}

interface CommunicationLogResponse {
    communication_logs: CommunicationLogRow[];
}

interface AccountAppealRow {
  appeal_id: number;
  created_at: string;
  user_id: number;
  username: string | null;
  user_role: string;
  account_status: string;
  target_admin_user_id: number | null;
  target_admin_username: string | null;
  message: string;
  appeal_status: string;
  admin_response: string | null;
  reviewed_by_user_id: number | null;
  reviewed_by_username: string | null;
  reviewed_at: string | null;
}

interface AccountAppealResponse {
  appeals: AccountAppealRow[];
}

export function AdminCommunicationLogsPage() {
  const [logs, setLogs] = useState<CommunicationLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appeals, setAppeals] = useState<AccountAppealRow[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(true);
  const [appealsError, setAppealsError] = useState('');
  const [resolveId, setResolveId] = useState<number | null>(null);

  const [driverIdInput, setDriverIdInput] = useState('');
  const [sponsorIdInput, setSponsorIdInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (driverIdInput.trim()) params.set('driver_id', driverIdInput.trim());
      if (sponsorIdInput.trim()) params.set('sponsor_id', sponsorIdInput.trim());
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo + 'T23:59:59');
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get<CommunicationLogResponse>(`/admin/communication-logs${qs}`);
      setLogs(data.communication_logs);
    } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr.message || 'Failed to load communication logs.');
    } finally {
        setLoading(false);
    }
  }

  const loadAppeals = async () => {
    setAppealsLoading(true);
    setAppealsError('');
    try {
      const data = await api.get<AccountAppealResponse>('/admin/account-appeals');
      setAppeals(data.appeals);
    } catch (err) {
      const apiErr = err as ApiError;
      setAppealsError(apiErr.message || 'Failed to load account appeals.');
    } finally {
      setAppealsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    loadAppeals();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const handleReset = () => {
    setDriverIdInput('');
    setSponsorIdInput('');
    setDateFrom('');
    setDateTo('');
    setKeyword('');
  };

  const resolveAppeal = async (appealId: number, status: 'resolved' | 'dismissed') => {
    setResolveId(appealId);
    try {
      await api.post(`/admin/account-appeals/${appealId}/resolve`, {
        status,
      });
      await loadAppeals();
    } catch (err) {
      const apiErr = err as ApiError;
      setAppealsError(apiErr.message || 'Failed to update appeal.');
    } finally {
      setResolveId(null);
    }
  };

  return (
    <section className="card" aria-labelledby="comm-logs-heading">
      <h2 id="comm-logs-heading">Communication Logs</h2>
      <p className="mt-1">
        View all messages exchanged between drivers and sponsors.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-2"
        style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
          <label htmlFor="filter-driver-id">Driver ID</label>
          <input
            id="filter-driver-id"
            type="number"
            min="1"
            value={driverIdInput}
            onChange={(e) => setDriverIdInput(e.target.value)}
            placeholder="Any"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
          <label htmlFor="filter-sponsor-id">Sponsor ID</label>
          <input
            id="filter-sponsor-id"
            type="number"
            min="1"
            value={sponsorIdInput}
            onChange={(e) => setSponsorIdInput(e.target.value)}
            placeholder="Any"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
          <label htmlFor="filter-date-from">From Date</label>
          <input
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
          <label htmlFor="filter-date-to">To Date</label>
          <input
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
          <label htmlFor="filter-keyword">Keyword</label>
          <input
            id="filter-keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search message text"
          />
        </div>

        <Button type="submit" disabled={loading}>Apply Filters</Button>
        <Button type="button" onClick={handleReset} disabled={loading}>Reset</Button>
      </form>

      <div className="mt-2">
        {loading ? (
          <Spinner label="Loading communication logs..." />
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : logs.length === 0 ? (
          <p className="placeholder-msg">No communication logs found for the selected filters.</p>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="devices-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Sent By</th>
                  <th>Driver</th>
                  <th>Sponsor</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.log_id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{log.sent_by_role}</td>
                    <td>
                      {log.driver_name || `Driver #${log.driver_user_id}`}
                    </td>
                    <td>
                      {log.sponsor_name || `Sponsor #${log.sponsor_user_id}`}
                    </td>
                    <td style={{ maxWidth: '400px', wordBreak: 'break-word' }}>
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3>Blocked Account Appeals</h3>
        <p className="helper-text mt-1">Messages submitted by blocked driver/sponsor users.</p>
        {appealsLoading ? (
          <Spinner label="Loading account appeals..." />
        ) : appealsError ? (
          <Alert variant="error">{appealsError}</Alert>
        ) : appeals.length === 0 ? (
          <p className="placeholder-msg">No account appeals submitted.</p>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="devices-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Target Admin</th>
                  <th>Message</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {appeals.map((appeal) => (
                  <tr key={appeal.appeal_id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(appeal.created_at).toLocaleString()}</td>
                    <td>
                      {appeal.username || `User #${appeal.user_id}`} ({appeal.user_role})
                    </td>
                    <td>
                      {appeal.account_status} / {appeal.appeal_status}
                    </td>
                    <td>{appeal.target_admin_username || (appeal.target_admin_user_id ? `Admin #${appeal.target_admin_user_id}` : '—')}</td>
                    <td style={{ maxWidth: '420px', whiteSpace: 'pre-wrap' }}>{appeal.message}</td>
                    <td>
                      {appeal.appeal_status === 'open' ? (
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <Button
                            type="button"
                            onClick={() => resolveAppeal(appeal.appeal_id, 'resolved')}
                            disabled={resolveId === appeal.appeal_id}
                          >
                            Resolve
                          </Button>
                          <Button
                            type="button"
                            onClick={() => resolveAppeal(appeal.appeal_id, 'dismissed')}
                            disabled={resolveId === appeal.appeal_id}
                          >
                            Dismiss
                          </Button>
                        </div>
                      ) : (
                        <span>
                          {appeal.reviewed_by_username || 'Admin'} at{' '}
                          {appeal.reviewed_at ? new Date(appeal.reviewed_at).toLocaleString() : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );  

}
