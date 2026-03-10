import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
import { api } from '../services/apiClient';
import type { UserRole } from '../types';

/* ── Notification Bell (driver only) ── */

interface DriverNotification {
  notification_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

function NotificationBell() {
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [open, setOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await api.get<{ notifications: DriverNotification[] }>('/api/driver/notifications');
      setNotifications(res.notifications);
    } catch {
      // silently fail — bell just won't update
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const unread = notifications.filter(n => !n.is_read).length;

  const dismiss = async (notificationId: number) => {
    try {
      await api.post(`/api/driver/notifications/${notificationId}/dismiss`);
      setNotifications(prev =>
        prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch {
      // silently fail
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', position: 'relative', padding: '0.25rem' }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -4,
            background: '#ef4444', color: '#fff',
            borderRadius: '9999px', fontSize: '0.65rem',
            fontWeight: 700, padding: '1px 5px', lineHeight: 1.4,
          }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '2.2rem',
          background: '#fff', border: '1px solid var(--color-border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          width: 320, maxHeight: 380, overflowY: 'auto', zIndex: 100,
          color: 'var(--color-text)',
        }}>
          <div style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>
              No notifications
            </p>
          ) : (
            notifications.map(n => (
              <div key={n.notification_id} style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-border)',
                background: n.is_read ? 'transparent' : '#eff6ff',
                display: 'flex', flexDirection: 'column', gap: '0.25rem',
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>{n.message}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => dismiss(n.notification_id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Types ── */

interface NavItem {
  to: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen: boolean;
}

interface GroupedNav {
  groups: NavGroup[];
  standalone: NavItem[];
}

/* ── Grouped nav config per role ── */

const ROLE_NAV: Record<UserRole, GroupedNav> = {
  driver: {
    groups: [
      {
        label: 'Overview',
        defaultOpen: true,
        items: [{ to: '/driver/dashboard', label: 'Dashboard' }],
      },
      {
        label: 'Rewards',
        defaultOpen: true,
        items: [
          { to: '/driver/points', label: 'Points' },
          { to: '/driver/catalog', label: 'Catalog' },
          { to: '/driver/orders', label: 'My Orders' },
        ],
      },
      {
        label: 'Account',
        defaultOpen: false,
        items: [
          { to: '/driver/profile', label: 'Profile' },
          { to: '/account/settings', label: 'Settings' },
        ],
      },
    ],
    standalone: [{ to: '/about', label: 'About' }],
  },

  sponsor: {
    groups: [
      {
        label: 'Overview',
        defaultOpen: true,
        items: [{ to: '/sponsor/dashboard', label: 'Dashboard' }],
      },
      {
        label: 'Driver Management',
        defaultOpen: true,
        items: [
          { to: '/sponsor/drivers', label: 'Drivers' },
          { to: '/sponsor/applications', label: 'Applications' },
          { to: '/sponsor/points', label: 'Points' },
        ],
      },
      {
        label: 'Incentive Program',
        defaultOpen: true,
        items: [
          { to: '/sponsor/reward-settings', label: 'Reward Settings' },
          { to: '/sponsor/catalog', label: 'Catalog' },
        ],
      },
      {
        label: 'Reporting',
        defaultOpen: true,
        items: [
          { to: '/sponsor/purchase-history', label: 'Purchase History' },
          { to: '/sponsor/error-logs', label: 'Error Logs' },
        ],
      },
      {
        label: 'Organization',
        defaultOpen: false,
        items: [
          { to: '/sponsor/profile', label: 'Sponsor Profile' },
          { to: '/account/settings', label: 'Settings' },
        ],
      },
    ],
    standalone: [{ to: '/about', label: 'About' }],
  },

  admin: {
    groups: [
      {
        label: 'Overview',
        defaultOpen: true,
        items: [{ to: '/admin/dashboard', label: 'Dashboard' }],
      },
      {
        label: 'Management',
        defaultOpen: true,
        items: [
          { to: '/admin/users', label: 'Users' },
          { to: '/admin/sponsors', label: 'Sponsors' },
        ],
      },
      {
        label: 'Reporting',
        defaultOpen: true,
        items: [
          { to: '/admin/reports', label: 'Reports' },
          { to: '/admin/audit-logs', label: 'Audit Logs' },
        ],
      },
      {
        label: 'Account',
        defaultOpen: false,
        items: [{ to: '/account/settings', label: 'Settings' }],
      },
    ],
    standalone: [{ to: '/about', label: 'About' }],
  },
};

/* ── Shared ── */

const ROLE_LABELS: Record<UserRole, string> = {
  driver: 'Driver',
  sponsor: 'Sponsor',
  admin: 'Admin',
};

function renderNavLink(item: NavItem) {
  return (
    <li key={item.to}>
      <NavLink
        to={item.to}
        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
      >
        {item.label}
      </NavLink>
    </li>
  );
}

/* ── Collapsible sidebar group ── */

function SidebarGroup({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(group.defaultOpen);

  return (
    <div className="sidebar-group">
      <button
        type="button"
        className="sidebar-group-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {group.label}
        <span className={`sidebar-group-chevron ${open ? 'expanded' : ''}`}>
          &#9654;
        </span>
      </button>
      <ul className={`sidebar-group-items ${open ? 'expanded' : 'collapsed'}`} role="list">
        {group.items.map(renderNavLink)}
      </ul>
    </div>
  );
}

/* ── Sidebar renderer ── */

function GroupedSidebar({ nav }: { nav: GroupedNav }) {
  return (
    <>
      {nav.groups.map((group) => (
        <SidebarGroup key={group.label} group={group} />
      ))}
      {nav.standalone.length > 0 && (
        <ul className="sidebar-standalone" role="list">
          {nav.standalone.map(renderNavLink)}
        </ul>
      )}
    </>
  );
}

/* ── Main layout ── */

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-header" role="banner">
        <span className="app-title">Good Driver Incentive Program</span>

        {user && (
          <div className="header-actions">
            <span
              className={`role-badge role-${user.role}`}
              aria-label={`Role: ${ROLE_LABELS[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
            <span className="header-username">{user.username}</span>
            {user.role === 'driver' && <NotificationBell />}
            <Button variant="secondary" onClick={handleLogout} type="button">
              Log out
            </Button>
          </div>
        )}
      </header>

      <div className="app-shell">
        {user && (
          <nav className="app-sidebar" aria-label="Main navigation">
            <GroupedSidebar nav={ROLE_NAV[user.role]} />
          </nav>
        )}

        <main id="main-content" className="app-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
