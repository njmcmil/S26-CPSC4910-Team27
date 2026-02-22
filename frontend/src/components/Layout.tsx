import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
import type { UserRole } from '../types';

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
        items: [{ to: '/sponsor/reports', label: 'Reports' }],
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
