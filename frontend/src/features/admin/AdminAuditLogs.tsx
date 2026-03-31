import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { Spinner } from '../../components/Spinner';
import type { ApiError } from '../../types';

// --- Action Logs ---
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

// --- Login Audit ---
interface LoginAuditRow {
  user_id: number | null;
  username: string;
  role: string | null;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  login_time: string;
}

interface LoginAuditResponse {
  login_audit: LoginAuditRow[];
}

type View = 'actions' | 'logins';

export function AdminAuditLogsPage() {
  const [view, setView] = useState<View>('actions');

  // Action logs state
  const [category, setCategory] = useState('sponsor_user_action');
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Login audit state
  const [loginRole, setLoginRole] = useState('');
  const [loginLogs, setLoginLogs] = useState<LoginAuditRow[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const loadActionLogs = async (nextCategory = category) => {
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

  const loadLoginAudit = async (nextRole = loginRole) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const qs = nextRole ? `?role=${encodeURIComponent(nextRole)}` : '';
      const data = await api.get<LoginAuditResponse>(`/admin/login-audit${qs}`);
      setLoginLogs(data.login_audit);
    } catch (err) {
      const apiErr = err as ApiError;
      setLoginError(apiErr.message || 'Failed to load login audit.');
    } finally {
      setLoginLoading(false);
    }
  };

  useEffect(() => {
    loadActionLogs();
  }, []);

  const handleViewChange = (nextView: View) => {
    setView(nextView);
    if (nextView === 'logins' && loginLogs.length === 0 && !loginLoading) {
      loadLoginAudit();
    }
  };

  return (
    <section className="card" aria-labelledby="audit-heading">
      <h2 id="audit-heading">Audit Logs</h2>
      <p className="mt-1">
        Review system audit activity: user actions and login events.
      </p>

      {/* View toggle */}
      <div className="mt-2" style={{ display: 'flex', gap: '0.5rem' }}>
        <Button
          type="button"
          onClick={() => handleViewChange('actions')}
          disabled={view === 'actions'}
        >
          Action Logs
        </Button>
        <Button
          type="button"
          onClick={() => handleViewChange('logins')}
          disabled={view === 'logins'}
        >
          Login Audit
        </Button>
      </div>

      {/* --- Action Logs --- */}
      {view === 'actions' && (
        <>
          <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
              <label htmlFor="audit-category">Category</label>
              <select
                id="audit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="sponsor_user_action">Sponsor User Actions</option>
                <option value="driver_user_action">Driver User Actions</option>
                <option value="point_change">Point Changes</option>
                <option value="driver_status_change">Driver Status Changes</option>
                <option value="">All Categories</option>
              </select>
            </div>
            <Button type="button" onClick={() => loadActionLogs(category)} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <Spinner label="Loading audit logs..." />
          ) : error ? (
            <div className="mt-2"><Alert variant="error">{error}</Alert></div>
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
                    <th>Reason / Action</th>
                    <th>Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={`${log.date}-${log.category}-${i}`}>
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
        </>
      )}

      {/* --- Login Audit --- */}
      {view === 'logins' && (
        <>
          <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
              <label htmlFor="login-role">Filter by Role</label>
              <select
                id="login-role"
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="sponsor">Sponsors</option>
                <option value="driver">Drivers</option>
              </select>
            </div>
            <Button type="button" onClick={() => loadLoginAudit(loginRole)} disabled={loginLoading}>
              Refresh
            </Button>
          </div>

          {loginLoading ? (
            <Spinner label="Loading login audit..." />
          ) : loginError ? (
            <div className="mt-2"><Alert variant="error">{loginError}</Alert></div>
          ) : loginLogs.length === 0 ? (
            <p className="placeholder-msg mt-2">No login audit entries found.</p>
          ) : (
            <div className="card mt-2" style={{ overflowX: 'auto' }}>
              <table className="devices-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {loginLogs.map((log, i) => (
                    <tr key={`${log.login_time}-${log.username}-${i}`}>
                      <td>{new Date(log.login_time).toLocaleString()}</td>
                      <td>{log.username}</td>
                      <td>{log.role || '\u2014'}</td>
                      <td style={{ color: log.success ? 'green' : 'red' }}>
                        {log.success ? 'Success' : 'Failed'}
                      </td>
                      <td>{log.ip_address || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
