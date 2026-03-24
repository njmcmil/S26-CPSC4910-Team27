import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';

interface UserRow {
  user_id: number;
  username: string;
  role: string;
  email: string;
}

type RoleFilter = 'all' | 'driver' | 'sponsor' | 'admin';

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<UserRow[]>('/admin/users')
      .then(setUsers)
      .catch((err: unknown) => {
        setError((err as { message?: string })?.message ?? 'Failed to load users.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      String(u.user_id).includes(q);
    return matchesRole && matchesSearch;
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

      {loading && <p className="mt-2">Loading…</p>}
      {error && (
        <p className="mt-2" style={{ color: 'var(--color-error, red)' }} role="alert">
          {error}
        </p>
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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '0.75rem', color: '#888' }}>
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
