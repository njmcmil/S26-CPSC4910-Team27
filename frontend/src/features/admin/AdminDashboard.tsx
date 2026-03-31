import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────

interface LoginAttempt {
  login_id: number;
  username: string;
  user_id: number | null;
  success: boolean;
  ip_address: string;
  user_agent: string;
  login_time: string;
}

interface AuditLog {
  date: string;
  category: string;
  sponsor_name: string | null;
  driver_id: number | null;
  points_changed: number | null;
  reason: string | null;
  changed_by_user_id: number | null;
}

interface DriverLog {
  date: string;
  driver_id: number;
  driver_username: string;
  sponsor_name: string | null;
  points_changed: number;
  reason: string;
  expires_at: string | null;
}

interface User {
  user_id: number;
  username: string;
  role: string;
  email: string;
}

type Tab = 'overview' | 'login-attempts' | 'audit-logs' | 'driver-logs' | 'users';

// ── Tab Button ─────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: 8,
        border: 'none',
        background: active ? '#2563eb' : 'var(--color-surface)',
        color: active ? '#fff' : 'var(--color-text)',
        fontWeight: active ? 700 : 400,
        cursor: 'pointer',
        fontSize: '0.9rem',
      }}
    >
      {label}
    </button>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Data states
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [driverLogs, setDriverLogs] = useState<DriverLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [loginFilter, setLoginFilter] = useState('');
  const [auditCategory, setAuditCategory] = useState('');
  const [driverFilter, setDriverFilter] = useState('');

  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'login-attempts') {
        const res = await api.get<{ login_attempts: LoginAttempt[] }>('/admin/login-attempts?limit=200');
        setLoginAttempts(res.login_attempts);
      } else if (tab === 'audit-logs') {
        const url = auditCategory
          ? `/admin/audit-logs?limit=200&category=${auditCategory}`
          : '/admin/audit-logs?limit=200';
        const res = await api.get<{ audit_logs: AuditLog[] }>(url);
        setAuditLogs(res.audit_logs);
      } else if (tab === 'driver-logs') {
        const res = await api.get<{ driver_logs: DriverLog[] }>('/admin/driver-logs?limit=200');
        setDriverLogs(res.driver_logs);
      } else if (tab === 'users') {
        const res = await api.get<User[]>('/admin/users');
        setUsers(res);
      }
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [auditCategory]);

  useEffect(() => {
    if (activeTab !== 'overview') {
      loadTab(activeTab);
    }
  }, [activeTab, loadTab]);

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    borderBottom: '2px solid var(--color-border)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'top',
  };

  return (
    <section aria-labelledby="admin-heading">
      <h2 id="admin-heading">Admin Dashboard</h2>
      <p className="mt-1">Welcome back, {user?.username}.</p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1.5rem 0 1rem' }}>
        <TabButton label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <TabButton label="Login Attempts" active={activeTab === 'login-attempts'} onClick={() => setActiveTab('login-attempts')} />
        <TabButton label="Audit Logs" active={activeTab === 'audit-logs'} onClick={() => setActiveTab('audit-logs')} />
        <TabButton label="Driver Logs" active={activeTab === 'driver-logs'} onClick={() => setActiveTab('driver-logs')} />
        <TabButton label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="placeholder-grid mt-2">
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('users')}>
            <h3>Users</h3>
            <p className="helper-text">View all users</p>
          </div>
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('login-attempts')}>
            <h3>Login Attempts</h3>
            <p className="helper-text">Monitor suspicious activity</p>
          </div>
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('audit-logs')}>
            <h3>Audit Logs</h3>
            <p className="helper-text">Every system change</p>
          </div>
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('driver-logs')}>
            <h3>Driver Logs</h3>
            <p className="helper-text">All driver point history</p>
          </div>
        </div>
      )}

      {/* Login Attempts */}
      {activeTab === 'login-attempts' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Login Attempts</h3>
            <input
              type="search"
              placeholder="Filter by username..."
              value={loginFilter}
              onChange={e => setLoginFilter(e.target.value)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            />
          </div>
          {loading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Username</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>IP Address</th>
                    <th style={thStyle}>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginAttempts
                    .filter(a => !loginFilter || a.username.toLowerCase().includes(loginFilter.toLowerCase()))
                    .map((a, i) => (
                      <tr key={i} style={{ background: a.success ? 'transparent' : '#fff5f5' }}>
                        <td style={tdStyle}>{new Date(a.login_time).toLocaleString()}</td>
                        <td style={tdStyle}>{a.username}</td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600,
                            background: a.success ? '#d1fae5' : '#fee2e2',
                            color: a.success ? '#065f46' : '#991b1b',
                          }}>
                            {a.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td style={tdStyle}>{a.ip_address}</td>
                        <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.user_agent}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs */}
      {activeTab === 'audit-logs' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Audit Logs</h3>
            <select
              value={auditCategory}
              onChange={e => { setAuditCategory(e.target.value); loadTab('audit-logs'); }}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            >
              <option value="">All Categories</option>
              <option value="point_change">Point Changes</option>
              <option value="driver_dropped">Driver Dropped</option>
            </select>
          </div>
          {loading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Sponsor</th>
                    <th style={thStyle}>Driver ID</th>
                    <th style={thStyle}>Points</th>
                    <th style={thStyle}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{new Date(log.date).toLocaleString()}</td>
                      <td style={tdStyle}>{log.category}</td>
                      <td style={tdStyle}>{log.sponsor_name ?? '—'}</td>
                      <td style={tdStyle}>{log.driver_id ?? '—'}</td>
                      <td style={tdStyle}>
                        {log.points_changed !== null ? (
                          <span style={{ color: log.points_changed >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {log.points_changed >= 0 ? '+' : ''}{log.points_changed}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}>{log.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Driver Logs */}
      {activeTab === 'driver-logs' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Driver Logs</h3>
            <input
              type="search"
              placeholder="Filter by username..."
              value={driverFilter}
              onChange={e => setDriverFilter(e.target.value)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
            />
          </div>
          {loading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Driver</th>
                    <th style={thStyle}>Sponsor</th>
                    <th style={thStyle}>Points</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {driverLogs
                    .filter(l => !driverFilter || l.driver_username?.toLowerCase().includes(driverFilter.toLowerCase()))
                    .map((log, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{new Date(log.date).toLocaleString()}</td>
                        <td style={tdStyle}>{log.driver_username}</td>
                        <td style={tdStyle}>{log.sponsor_name ?? '—'}</td>
                        <td style={tdStyle}>
                          <span style={{ color: log.points_changed >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {log.points_changed >= 0 ? '+' : ''}{log.points_changed}
                          </span>
                        </td>
                        <td style={tdStyle}>{log.reason}</td>
                        <td style={tdStyle}>{log.expires_at ? new Date(log.expires_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>All Users</h3>
          {loading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Username</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id}>
                      <td style={tdStyle}>{u.user_id}</td>
                      <td style={tdStyle}>{u.username}</td>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600,
                          background: u.role === 'admin' ? '#fef3c7' : u.role === 'sponsor' ? '#eff6ff' : '#f0fdf4',
                          color: u.role === 'admin' ? '#92400e' : u.role === 'sponsor' ? '#1e40af' : '#166534',
                        }}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
