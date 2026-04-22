import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../services/apiClient';
import { Alert } from '../../components/Alert';
import { useAuth } from '../../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { ApiError } from '../../types';

interface UserRow {
  user_id: number;
  username: string;
  role: string;
  email: string;
  account_status: string;
}

type RoleFilter = 'all' | 'driver' | 'sponsor' | 'admin';
type CreateRole = 'driver' | 'sponsor' | 'admin';

interface CreateUserForm {
  username: string;
  email: string;
  password: string;
  role: CreateRole;
}

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
  const [createLoading, setCreateLoading] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    username: '',
    email: '',
    password: '',
    role: 'driver',
  });

  const loadUsers = () => {
    setLoading(true);
    api.get<UserRow[]>('/admin/users')
      .then(setUsers)
      .catch((err: unknown) => {
        setError((err as { message?: string })?.message ?? 'Failed to load users.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateSuccess(null);
    setError(null);

    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password) {
      setError('Username, email, and password are required to create a user.');
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
      };
      let response: { message: string };
      try {
        response = await api.post<{ message: string }>('/admin/users', payload);
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        const oldBackendMissingRoute = apiErr.status === 404 || apiErr.status === 405;
        if (oldBackendMissingRoute && payload.role !== 'admin') {
          // Backward compatibility while prod API catches up.
          response = await api.post<{ message: string }>('/create-user', payload);
        } else if (oldBackendMissingRoute && payload.role === 'admin') {
          throw {
            message:
              'This deployed backend does not support admin creation yet. Deploy latest backend and try again.',
          };
        } else {
          throw err;
        }
      }
      setCreateSuccess(response.message || 'User created successfully.');
      setCreateForm({
        username: '',
        email: '',
        password: '',
        role: 'driver',
      });
      loadUsers();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Could not create user.');
    } finally {
      setCreateLoading(false);
    }
  };

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

      <form
        onSubmit={createUser}
        className="mt-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.6rem',
          alignItems: 'end',
          padding: '0.8rem',
          border: '1px solid #e5e7eb',
          borderRadius: '0.6rem',
          background: '#f9fafb',
        }}
      >
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Username
          <input
            type="text"
            autoComplete="username"
            value={createForm.username}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Email
          <input
            type="email"
            autoComplete="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Password
          <input
            type="password"
            autoComplete="new-password"
            value={createForm.password}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Role
          <select
            value={createForm.role}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as CreateRole }))}
          >
            <option value="driver">Driver</option>
            <option value="sponsor">Sponsor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={createLoading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {createLoading ? 'Creating…' : 'Add New User'}
        </button>
      </form>

      <p className="mt-1" style={{ fontSize: '0.82rem', color: '#6b7280' }}>
        Password must meet complexity requirements (8+ chars, upper/lowercase, number, special character).
      </p>
      {createSuccess && (
        <p className="mt-1" style={{ color: '#166534', fontWeight: 600 }}>
          {createSuccess}
        </p>
      )}

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
