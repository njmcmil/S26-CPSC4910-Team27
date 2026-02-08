/* ── Roles ── */
export type UserRole = 'driver' | 'sponsor' | 'admin';

/* ── Auth ── */
export interface LoginRequest {
  username: string;
  password: string;
  remember_device?: boolean;
}

export interface LoginResponse {
  user_id: number;
  username: string;
  role: UserRole;
  email: string;
  access_token: string;
}

export interface AuthUser {
  user_id: number;
  username: string;
  role: UserRole;
  email: string;
}

/* ── Trusted Devices ── */
export interface TrustedDevice {
  id: string;
  device_name: string;
  last_used: string;
  created_at: string;
}

/* ── Driver Profile ── */
export interface DriverProfile {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  license_number: string;
  points_balance: number;
  sponsor_name: string;
}

/* ── Sponsor Profile ── */
export interface SponsorProfile {
  user_id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  point_value: number;
}

export interface SponsorProfileUpdate {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  point_value: number;
}

/* ── API Errors ── */
export interface ApiError {
  status: number;
  message: string;
  detail?: string;
  fieldErrors?: Record<string, string>;
}
