import { api } from './apiClient';

export interface SystemMetrics {
  fetched_at: string;
  // Users
  total_users: number;
  total_drivers: number;
  total_sponsors: number;
  total_admins: number;
  // Orders
  total_orders: number;
  pending_orders: number;
  shipped_orders: number;
  cancelled_orders: number;
  // Points
  total_points_awarded: number;
  total_points_redeemed: number;
  // Logins (last 24 h)
  logins_last_24h: number;
  failed_logins_last_24h: number;
}

export function fetchSystemMetrics(): Promise<SystemMetrics> {
  return api.get<SystemMetrics>('/admin/metrics');
}

// ── Sponsor status management ──────────────────────────────────────────────

export interface SponsorAdminRow {
  user_id: number;
  username: string;
  email: string;
  company_name: string | null;
  account_status: string;
}

export function fetchAdminSponsors(): Promise<SponsorAdminRow[]> {
  return api.get<SponsorAdminRow[]>('/admin/sponsors');
}

export function updateSponsorStatus(
  userId: number,
  newStatus: string,
  reason?: string,
): Promise<{ message: string; new_status: string }> {
  return api.post(`/admin/sponsors/${userId}/status`, { new_status: newStatus, reason: reason ?? null });
}

// ── Driver status management ───────────────────────────────────────────────

export interface DriverAdminRow {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string;
}

export function fetchAdminDrivers(): Promise<DriverAdminRow[]> {
  return api.get<DriverAdminRow[]>('/admin/drivers');
}

export function updateDriverStatus(
  userId: number,
  newStatus: string,
): Promise<{ message: string; new_status: string }> {
  return api.post(`/admin/drivers/${userId}/status`, { new_status: newStatus });
}