import { useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { Alert } from '../../components/Alert';

interface SponsorRow {
  user_id: number;
  username: string;
  email: string;
  company_name: string | null;
  account_status: string;
}

type StatusAction = 'inactive' | 'active' | 'banned';

interface ConfirmState {
  sponsor: SponsorRow;
  action: StatusAction;
  label: string;
}

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  active:   { background: '#dcfce7', color: '#166534' },
  inactive: { background: '#fef9c3', color: '#854d0e' },
  banned:   { background: '#fee2e2', color: '#991b1b' },
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

function actionButtons(sponsor: SponsorRow, onAction: (s: SponsorRow, a: StatusAction, label: string) => void) {
  const { account_status: st } = sponsor;
  const btn = (action: StatusAction, label: string, bg: string, color: string) => (
    <button
      key={action}
      onClick={() => onAction(sponsor, action, label)}
      style={{
        padding: '0.25rem 0.65rem',
        fontSize: '0.78rem',
        fontWeight: 600,
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        background: bg,
        color,
        marginRight: '0.35rem',
      }}
    >
      {label}
    </button>
  );

  if (st === 'active') return (
    <>
      {btn('inactive', 'Deactivate', '#fef9c3', '#854d0e')}
      {btn('banned', 'Ban', '#fee2e2', '#991b1b')}
    </>
  );
  if (st === 'inactive') return btn('active', 'Reactivate', '#dcfce7', '#166534');
  if (st === 'banned')   return btn('active', 'Unban', '#dcfce7', '#166534');
  return null;
}

export function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<SponsorRow[]>('/admin/sponsors')
      .then(setSponsors)
      .catch((err: unknown) => setError((err as { message?: string })?.message ?? 'Failed to load sponsors.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function openConfirm(sponsor: SponsorRow, action: StatusAction, label: string) {
    setConfirm({ sponsor, action, label });
    setConfirmReason('');
  }

  async function executeAction() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/sponsors/${confirm.sponsor.user_id}/status`, {
        new_status: confirm.action,
        reason: confirmReason.trim() || null,
      });
      showToast(`${confirm.label}d ${confirm.sponsor.username} successfully.`, true);
      setConfirm(null);
      load();
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message ?? 'Action failed.', false);
    } finally {
      setActionLoading(false);
    }
  }

  const filtered = sponsors.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.username.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.company_name ?? '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || s.account_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const needsConfirm = confirm?.action === 'inactive' || confirm?.action === 'banned';

  return (
    <section className="card" aria-labelledby="sponsors-heading">
      <h2 id="sponsors-heading">Sponsor Management</h2>
      <p className="mt-1">View and manage sponsor account statuses.</p>

      {/* Filters */}
      <div className="mt-2" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search by username, email, or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.4rem 0.6rem', minWidth: '240px' }}
          aria-label="Search sponsors"
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['all', 'active', 'inactive', 'banned'] as const).map((f) => (
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
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '0.75rem', color: '#888' }}>
                    No sponsors match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.user_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{s.user_id}</td>
                    <td style={tdStyle}>{s.username}</td>
                    <td style={tdStyle}>{s.company_name ?? '—'}</td>
                    <td style={{ ...tdStyle, color: '#555' }}>{s.email}</td>
                    <td style={tdStyle}><StatusBadge status={s.account_status} /></td>
                    <td style={tdStyle}>{actionButtons(s, openConfirm)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
            Showing {filtered.length} of {sponsors.length} sponsors
          </p>
        </div>
      )}

      {/* Confirmation modal */}
      {confirm && (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div style={modalBoxStyle}>
            <h3 id="confirm-title" style={{ marginTop: 0 }}>
              Confirm: {confirm.label} — {confirm.sponsor.username}
            </h3>
            <p style={{ color: '#555', marginBottom: '0.75rem' }}>
              {confirm.action === 'inactive' &&
                'Deactivating this sponsor will notify them by email. They will retain their profile data.'}
              {confirm.action === 'banned' &&
                'Banning this sponsor will notify them by email. This is a more severe action.'}
              {confirm.action === 'active' &&
                `This will reactivate / unban the sponsor's account.`}
            </p>

            {needsConfirm && (
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="reason-input" style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Reason {confirm.action === 'banned' ? '(required)' : '(optional)'}
                </label>
                <textarea
                  id="reason-input"
                  rows={3}
                  value={confirmReason}
                  onChange={(e) => setConfirmReason(e.target.value)}
                  placeholder="Provide a reason…"
                  style={{ width: '100%', padding: '0.4rem', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #ccc' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirm(null)}
                disabled={actionLoading}
                style={{ padding: '0.4rem 1rem', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={
                  actionLoading ||
                  (confirm.action === 'banned' && !confirmReason.trim())
                }
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  background:
                    confirm.action === 'banned' ? '#dc2626' :
                    confirm.action === 'inactive' ? '#ca8a04' : '#16a34a',
                  color: '#fff',
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? 'Processing…' : `Confirm ${confirm.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '0.5rem 0.75rem' };

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalBoxStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: '1.5rem',
  maxWidth: 460, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};
