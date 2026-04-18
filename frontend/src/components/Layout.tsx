import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
import { Breadcrumbs } from './Breadcrumbs';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';
import { api } from '../services/apiClient';
import type { UserRole } from '../types';

const KEYBOARD_MODE_STORAGE_KEY = 'gdip_keyboard_mode';
const ROLE_HOME: Record<UserRole, string> = {
  driver: '/driver/dashboard',
  sponsor: '/sponsor/dashboard',
  admin: '/admin/dashboard',
};

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
  const bellRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!bellRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

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
    <div ref={bellRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="driver-notifications-panel"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.25rem',
          width: 34,
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
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
        <div id="driver-notifications-panel" style={{
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

function KeyboardHelpDock() {
  const [open, setOpen] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(
    () => localStorage.getItem(KEYBOARD_MODE_STORAGE_KEY) === 'true',
  );

  useEffect(() => {
    const syncKeyboardMode = () => {
      setKeyboardMode(localStorage.getItem(KEYBOARD_MODE_STORAGE_KEY) === 'true');
    };

    window.addEventListener('storage', syncKeyboardMode);
    window.addEventListener('gdip-keyboard-mode-changed', syncKeyboardMode);

    return () => {
      window.removeEventListener('storage', syncKeyboardMode);
      window.removeEventListener('gdip-keyboard-mode-changed', syncKeyboardMode);
    };
  }, []);

  const toggleKeyboardMode = () => {
    const next = !keyboardMode;
    localStorage.setItem(KEYBOARD_MODE_STORAGE_KEY, next ? 'true' : 'false');
    window.dispatchEvent(new Event('gdip-keyboard-mode-changed'));
    setKeyboardMode(next);
  };

  return (
    <div className="keyboard-help-dock">
      <button
        type="button"
        className="keyboard-help-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="keyboard-help-panel"
      >
        <span aria-hidden="true">⌨</span>
        <span>Keyboard</span>
        {keyboardMode && <span className="keyboard-help-enabled-indicator" aria-hidden="true">✓</span>}
      </button>

      {open && (
        <div id="keyboard-help-panel" className="keyboard-help-panel">
          <strong>Keyboard Controls</strong>
          <div className="keyboard-help-status-row">
            <span className={`keyboard-help-status ${keyboardMode ? 'on' : 'off'}`}>
              {keyboardMode ? 'Keyboard mode is on' : 'Keyboard mode is off'}
            </span>
            <button
              type="button"
              className="keyboard-help-toggle"
              onClick={toggleKeyboardMode}
            >
              Turn {keyboardMode ? 'Off' : 'On'}
            </button>
          </div>
          <ul className="keyboard-help-list">
            <li><kbd>Tab</kbd>: next control</li>
            <li><kbd>Shift</kbd> + <kbd>Tab</kbd>: previous control</li>
            <li><kbd>Enter</kbd>: open focused link or button</li>
            <li><kbd>Space</kbd>: activate buttons and checkboxes</li>
            <li><kbd>Esc</kbd>: return to overview in keyboard mode</li>
          </ul>
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
        items: [
          { to: '/driver/dashboard', label: 'Dashboard' },
          { to: '/driver/applications', label: 'Applications' },
        ],
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
          { to: '/sponsor/reports', label: 'Reports' },
          { to: '/sponsor/purchase-history', label: 'Purchase History' },
          { to: '/sponsor/error-logs', label: 'Error Logs' },
        ],
      },
      {
        label: 'Organization',
        defaultOpen: false,
        items: [
          { to: '/sponsor/profile', label: 'Sponsor Profile' },
          { to: '/sponsor/users', label: 'Sponsor Users' },
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
          { to: '/admin/users', label: 'User Accounts' },
          { to: '/admin/sponsors', label: 'Sponsor Accounts' },
          { to: '/admin/drivers', label: 'Driver Accounts' },
          { to: '/admin/driver-sponsors', label: 'Driver Sponsors Map' },
          { to: '/admin/bulk-upload', label: 'Bulk Account Upload' },
        ],
      },
      {
        label: 'Reporting',
        defaultOpen: true,
        items: [
          { to: '/admin/reports', label: 'Reports' },
          { to: '/admin/audit-logs', label: 'Audit Logs' },
          { to: '/admin/communication-logs', label: 'Communication Logs' },
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
  const groupId = `sidebar-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="sidebar-group">
      <button
        type="button"
        className="sidebar-group-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={groupId}
      >
        {group.label}
        <span className={`sidebar-group-chevron ${open ? 'expanded' : ''}`}>
          &#9654;
        </span>
      </button>
      <ul
        id={groupId}
        className={`sidebar-group-items ${open ? 'expanded' : 'collapsed'}`}
        role="list"
      >
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

/* ── Sponsor Switcher (driver only, multi-sponsor) ── */

function SponsorSwitcher() {
  const { sponsors, activeSponsorId, setActiveSponsorId } = useAuth();

  if (sponsors.length <= 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <label
        htmlFor="sponsor-switcher"
        style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}
      >
        Sponsor:
      </label>
      <select
        id="sponsor-switcher"
        value={activeSponsorId ?? ''}
        onChange={(e) => setActiveSponsorId(Number(e.target.value))}
        style={{
          fontSize: '0.85rem',
          padding: '0.25rem 0.5rem',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        {sponsors.map((s) => (
          <option key={s.sponsor_user_id} value={s.sponsor_user_id} style={{ color: '#000' }}>
            {s.sponsor_name} ({s.total_points.toLocaleString()} pts)
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Main layout ── */

export function Layout() {
  const { user, logout, stopImpersonation } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const breadcrumbs = useBreadcrumbs();
  const isBlockedPage = location.pathname === '/account-blocked';

  useEffect(() => {
    const applyKeyboardMode = () => {
      const enabled = localStorage.getItem(KEYBOARD_MODE_STORAGE_KEY) === 'true';
      setKeyboardMode(enabled);
      document.documentElement.dataset.keyboardMode = enabled ? 'enabled' : 'default';
    };

    applyKeyboardMode();
    window.addEventListener('storage', applyKeyboardMode);
    window.addEventListener('gdip-keyboard-mode-changed', applyKeyboardMode);

    return () => {
      window.removeEventListener('storage', applyKeyboardMode);
      window.removeEventListener('gdip-keyboard-mode-changed', applyKeyboardMode);
    };
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      const main = mainRef.current;
      if (!main) return;

      const heading = main.querySelector<HTMLElement>('h1, h2, [data-page-heading]');
      if (heading) {
        const hadTabIndex = heading.hasAttribute('tabindex');
        if (!hadTabIndex) {
          heading.setAttribute('tabindex', '-1');
        }
        heading.focus();
      } else {
        main.focus();
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [location.pathname]);

  useEffect(() => {
    if (!keyboardMode || !user) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        !!target?.isContentEditable;

      if (isEditable) return;

      const homePath = ROLE_HOME[user.role];
      if (location.pathname === homePath) return;

      event.preventDefault();
      navigate(homePath);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardMode, location.pathname, navigate, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleStopImpersonation = async () => {
    try {
      setStoppingImpersonation(true);
      const role = await stopImpersonation();
      navigate(`/${role}/dashboard`);
    } finally {
      setStoppingImpersonation(false);
    }
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
            {user.role === 'driver' && !isBlockedPage && <SponsorSwitcher />}
            <span
              className={`role-badge role-${user.role}`}
              aria-label={`Role: ${ROLE_LABELS[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
            <span className="header-username">{user.username}</span>
            {user.role === 'driver' && !isBlockedPage && <NotificationBell />}
            <Button variant="secondary" onClick={handleLogout} type="button">
              Log out
            </Button>
          </div>
        )}
      </header>

      <div className="app-shell">
        {user && !isBlockedPage && (
          <nav className="app-sidebar" aria-label="Main navigation">
            <GroupedSidebar nav={ROLE_NAV[user.role]} />
          </nav>
        )}

        <main id="main-content" className="app-content" ref={mainRef} tabIndex={-1}>
          {user?.is_impersonating && user.original_role === 'admin' && (
            <div
              role="status"
              aria-live="polite"
              className="impersonation-banner"
            >
              <span>
                Viewing as <strong>{user.role}</strong>. You can return to your admin session at any time.
              </span>
              <button
                type="button"
                onClick={handleStopImpersonation}
                disabled={stoppingImpersonation}
                className="btn btn-primary btn-sm impersonation-banner-btn"
              >
                {stoppingImpersonation ? 'Returning...' : 'Return As Admin'}
              </button>
            </div>
          )}
          {!isBlockedPage && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
          <Outlet />
        </main>
      </div>

      <KeyboardHelpDock />
    </>
  );
}
