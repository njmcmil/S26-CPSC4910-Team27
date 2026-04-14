import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Alert } from '../../components/Alert';

interface DriverRow {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string;
}

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  active:   { background: '#dcfce7', color: '#166534' },
  inactive: { background: '#fef9c3', color: '#854d0e' },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { background: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      ...colors,
      display: 'inline-block',
      padding: '0.15rem 0.55rem',
      borderRadius: '9999px',
      fontSize: '0.8rem',
      fontWeight: 600,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

export function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<DriverRow[]>('/admin/drivers')
      .then(setDrivers)
      .catch((err: unknown) => setError((err as { message?: string })?.message ?? 'Failed to load drivers.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function changeStatus(driver: DriverRow, newStatus: 'active' | 'inactive') {
    setActionLoading(driver.user_id);
    try {
      await api.post(`/admin/drivers/${driver.user_id}/status`, { new_status: newStatus });
      showToast(
        `${driver.username} ${newStatus === 'inactive' ? 'deactivated' : 'reactivated'} successfully.`,
        true,
      );
      load();
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message ?? 'Action failed.', false);
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const fullName = `${d.first_name ?? ''} ${d.last_name ?? ''}`.toLowerCase();
    const matchesSearch =
      !q ||
      d.username.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      fullName.includes(q);
    const matchesStatus = statusFilter === 'all' || d.account_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="card" aria-labelledby="drivers-heading">
      <h2 id="drivers-heading">Driver Management</h2>
      <p className="mt-1">View and manage driver account statuses.</p>

      {/* Filters */}
      <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search by username, email, or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.4rem 0.6rem', minWidth: '240px' }}
          aria-label="Search drivers"
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '0.3rem 0.75rem',
                fontWeight: statusFilter === f ? 700 : 400,
                opacity: statusFilter === f ? 1 : 0.6,
                borderRadius: 6,
                border: '1px solid #ccc',
                cursor: 'pointer',
                background: statusFilter === f ? '#e0e7ff' : 'transparent',
              }}
              aria-pressed={statusFilter === f}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <p
          role="alert"
          className="mt-2"
          style={{ color: toast.ok ? '#166534' : 'var(--color-error, red)', fontWeight: 600 }}
        >
          {toast.ok ? '✓ ' : '✗ '}{toast.msg}
        </p>
      )}

      {loading && <p className="mt-2">Loading…</p>}
      {error && <div className="mt-2"><Alert variant="error">{error}</Alert></div>}

      {!loading && !error && (
        <div className="mt-2" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '0.75rem', color: '#888' }}>
                    No drivers match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const busy = actionLoading === d.user_id;
                  return (
                    <tr key={d.user_id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{d.user_id}</td>
                      <td style={tdStyle}>{d.username}</td>
                      <td style={tdStyle}>
                        {d.first_name || d.last_name
                          ? `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim()
                          : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: '#555' }}>{d.email}</td>
                      <td style={tdStyle}><StatusBadge status={d.account_status} /></td>
                      <td style={tdStyle}>
                        {d.account_status === 'active' ? (
                          <button
                            onClick={() => changeStatus(d, 'inactive')}
                            disabled={busy}
                            style={actionBtnStyle('#fef9c3', '#854d0e', busy)}
                          >
                            {busy ? '…' : 'Deactivate'}
                          </button>
                        ) : (
                          <button
                            onClick={() => changeStatus(d, 'active')}
                            disabled={busy}
                            style={actionBtnStyle('#dcfce7', '#166534', busy)}
                          >
                            {busy ? '…' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
            Showing {filtered.length} of {drivers.length} drivers
          </p>
        </div>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '0.5rem 0.75rem' };

function actionBtnStyle(bg: string, color: string, disabled: boolean): React.CSSProperties {
  return {
    padding: '0.25rem 0.65rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: bg,
    color,
    opacity: disabled ? 0.6 : 1,
  };
}
