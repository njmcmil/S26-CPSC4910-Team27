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