import { useLocation, matchPath } from 'react-router-dom';
import type { BreadcrumbItem } from '../components/Breadcrumbs';

interface RouteConfig {
  pattern: string;
  crumbs: BreadcrumbItem[];
}

/**
 * Maps every app route to its breadcrumb trail.
 * Patterns are checked top-to-bottom; more-specific patterns (e.g. /driver/catalog/:itemId)
 * must come before their prefix (/driver/catalog) to match correctly.
 * An empty crumbs array means no breadcrumb bar is shown (used on dashboard home pages).
 */
const ROUTE_CONFIG: RouteConfig[] = [
  // ── Driver ──────────────────────────────────────────
  { pattern: '/driver/dashboard', crumbs: [] },

  {
    pattern: '/driver/applications',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Applications' },
    ],
  },
  {
    pattern: '/driver/profile',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Profile' },
    ],
  },
  {
    pattern: '/driver/points',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Points' },
    ],
  },
  {
    pattern: '/driver/catalog/:itemId',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Catalog', to: '/driver/catalog' },
      { label: 'Product Detail' },
    ],
  },
  {
    pattern: '/driver/catalog',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Catalog' },
    ],
  },
  {
    pattern: '/driver/orders',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'My Orders' },
    ],
  },
  {
    pattern: '/driver/cart',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Cart' },
    ],
  },
  {
    pattern: '/driver/checkout',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Cart', to: '/driver/cart' },
      { label: 'Checkout' },
    ],
  },
  {
    pattern: '/driver/order-confirmation',
    crumbs: [
      { label: 'Dashboard', to: '/driver/dashboard' },
      { label: 'Order Confirmation' },
    ],
  },

  // ── Sponsor ─────────────────────────────────────────
  { pattern: '/sponsor/dashboard', crumbs: [] },

  {
    pattern: '/sponsor/profile',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Sponsor Profile' },
    ],
  },
  {
    pattern: '/sponsor/applications',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Applications' },
    ],
  },
  {
    pattern: '/sponsor/drivers',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Drivers' },
    ],
  },
  {
    pattern: '/sponsor/points',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Points' },
    ],
  },
  {
    pattern: '/sponsor/reward-settings',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Reward Settings' },
    ],
  },
  {
    pattern: '/sponsor/catalog',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Catalog' },
    ],
  },
  {
    pattern: '/sponsor/reports',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Reports' },
    ],
  },
  {
    pattern: '/sponsor/purchase-history',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Purchase History' },
    ],
  },
  {
    pattern: '/sponsor/audit-logs',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Audit Logs' },
    ],
  },
  {
    pattern: '/sponsor/error-logs',
    crumbs: [
      { label: 'Dashboard', to: '/sponsor/dashboard' },
      { label: 'Error Logs' },
    ],
  },

  // ── Admin ────────────────────────────────────────────
  { pattern: '/admin/dashboard', crumbs: [] },
  { pattern: '/admin', crumbs: [] },

  {
    pattern: '/admin/users',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Management' },
      { label: 'Users' },
    ],
  },
  {
    pattern: '/admin/sponsors',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Management' },
      { label: 'Sponsors' },
    ],
  },
  {
    pattern: '/admin/drivers',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Management' },
      { label: 'Drivers' },
    ],
  },
  {
    pattern: '/admin/driver-sponsors',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Management' },
      { label: 'Driver Sponsors' },
    ],
  },
  {
    pattern: '/admin/bulk-upload',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Management' },
      { label: 'Bulk Upload' },
    ],
  },
  {
    pattern: '/admin/reports',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Reporting' },
      { label: 'Reports' },
    ],
  },
  {
    pattern: '/admin/audit-logs',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Reporting' },
      { label: 'Audit Logs' },
    ],
  },
  {
    pattern: '/admin/communication-logs',
    crumbs: [
      { label: 'Dashboard', to: '/admin/dashboard' },
      { label: 'Reporting' },
      { label: 'Communication Logs' },
    ],
  },

  // ── Common ───────────────────────────────────────────
  {
    pattern: '/account/settings',
    crumbs: [{ label: 'Settings' }],
  },
  {
    pattern: '/about',
    crumbs: [{ label: 'About' }],
  },
];

/**
 * Returns the breadcrumb trail for the current route.
 * Returns [] for routes that have no breadcrumb (dashboard roots, public pages).
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const { pathname } = useLocation();

  for (const { pattern, crumbs } of ROUTE_CONFIG) {
    if (matchPath({ path: pattern, end: true }, pathname)) {
      return crumbs;
    }
  }

  return [];
}
