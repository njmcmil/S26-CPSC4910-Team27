import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Alert } from '../../components/Alert';
import { useAuth } from '../../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

interface UserRow {
  user_id: number;
  username: string;
  role: string;
  email: string;
  account_status: string;
}

type RoleFilter = 'all' | 'driver' | 'sponsor' | 'admin';

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  active: { background: '#dcfce7', color: '#166534' },
  inactive: { background: '#fef9c3', color: '#854d0e' },
  banned: { background: '#fee2e2', color: '#991b1b' },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { background: '#f3f4f6', color: '#374151' };
  return (
    <span
      style={{
        ...colors,
        display: 'inline-block',
        padding: '0.15rem 0.55rem',
        borderRadius: '999px',
        fontSize: '0.78rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

export function AdminUsersPage() {
  const { impersonateUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const [impersonatingUserId, setImpersonatingUserId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'sponsor' | 'driver'>('admin');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<UserRow[]>('/admin/users')
      .then(setUsers)
      .catch((err: unknown) => {
        setError((err as { message?: string })?.message ?? 'Failed to load users.');
      })
      .finally(() => setLoading(false));
  }, []);

  const startViewAs = async (user: UserRow) => {
    if (user.role !== 'driver' && user.role !== 'sponsor') return;
    try {
      setImpersonatingUserId(user.user_id);
      const role = await impersonateUser(user.user_id);
      navigate(`/${role}/dashboard`);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Unable to start view-as session.');
    } finally {
      setImpersonatingUserId(null);
    }
  };

  const handleCreateUser = async () => {
    setCreateError('');
    setCreateSuccess('');
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateError('All fields are required.');
      return;
    }
    setCreating(true);
    try {
      await api.post('/create-user', {
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setCreateSuccess(`User "${newUsername}" created successfully!`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('admin');
      setShowCreateForm(false);
      const res = await api.get<UserRow[]>('/admin/users');
      setUsers(res);
    } catch (err: any) {
      setCreateError(err?.message ?? 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };
  
  const filtered = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      String(u.user_id).includes(q);
    return matchesRole && matchesSearch;
  }).sort((a, b) => {
    const statusRank: Record<string, number> = { banned: 0, inactive: 1, active: 2 };
    const rankDiff = (statusRank[a.account_status] ?? 9) - (statusRank[b.account_status] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    return a.username.localeCompare(b.username);
  });

  return (
    <section className="card" aria-labelledby="users-heading">
      <h2 id="users-heading">User Management</h2>
      <p className="mt-1">View all users and their IDs. Use driver IDs in the Driver Sponsors Lookup.</p>

      <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search by ID, username, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.4rem 0.6rem', minWidth: '220px' }}
          aria-label="Search users"
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['all', 'driver', 'sponsor', 'admin'] as RoleFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '0.3rem 0.75rem',
                fontWeight: roleFilter === r ? 700 : 400,
                opacity: roleFilter === r ? 1 : 0.6,
              }}
              aria-pressed={roleFilter === r}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {createSuccess && <Alert variant="success">{createSuccess}</Alert>}

      <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary"
          onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(''); }}>
          {showCreateForm ? '✕ Cancel' : '+ Add New User'}
        </button>
      </div>

      {showCreateForm && (
        <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 480 }}>
          <h3 style={{ marginBottom: '1rem' }}>Create New User</h3>
          {createError && <Alert variant="error">{createError}</Alert>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Username</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'sponsor' | 'driver')}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                <option value="admin">Admin</option>
                <option value="sponsor">Sponsor</option>
                <option value="driver">Driver</option>
              </select>
            </div>
            <button type="button" onClick={handleCreateUser} disabled={creating} className="btn btn-primary">
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      )}
      {loading && <p className="mt-2">Loading…</p>}
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-2" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>ID</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Username</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '0.75rem', color: '#888' }}>
                    No users match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.user_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>
                      {u.user_id}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{u.username}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background:
                            u.role === 'driver' ? '#dbeafe' :
                            u.role === 'sponsor' ? '#dcfce7' :
                            '#f3e8ff',
                          color:
                            u.role === 'driver' ? '#1d4ed8' :
                            u.role === 'sponsor' ? '#15803d' :
                            '#7e22ce',
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#555' }}>{u.email}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <StatusBadge status={u.account_status || 'active'} />
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {(u.role === 'driver' || u.role === 'sponsor') ? (
                        <button
                          type="button"
                          onClick={() => startViewAs(u)}
                          disabled={impersonatingUserId === u.user_id}
                          className="btn btn-secondary btn-sm admin-view-as-btn"
                        >
                          {impersonatingUserId === u.user_id ? 'Opening…' : `View as ${u.role}`}
                        </button>
                      ) : (
                        <span style={{ color: '#888' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
            Showing {filtered.length} of {users.length} users
          </p>
        </div>
      )}
    </section>
  );
}
