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

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/* ── About ── */
export interface AboutInfo {
  team_number: number;
  version_number: string;
  sprint_number: number;
  release_date: string;
  product_name: string;
  product_description: string;
}

/* ── Trusted Devices ── */
export interface TrustedDevice {
  device_id: number;
  device_name: string;
  device_type: string;
  ip_address: string;
  last_used: string;
  created_at: string;
  is_active: boolean;
}

/* ── Driver Profile ── */
export interface DriverProfile {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  license_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_license_plate: string | null;
  points_balance: number;
  profile_picture_url: string | null;
  bio: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/* ── Sponsor Profile ── */
export interface SponsorProfile {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  industry: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  total_points_allocated: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface SponsorProfileUpdate {
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_state?: string | null;
  company_zip?: string | null;
  industry?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
  profile_picture_url?: string | null;
  bio?: string | null;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface DriverApplication {
  application_id: number;
  driver_user_id: number;
  sponsor_user_id: number;
  status: ApplicationStatus;
  license_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_license_plate: string;
  created_at: string;
  updated_at: string | null;
  username: string;
  email: string;
}

export interface RejectApplicationRequest {
  rejection_category:
    | 'Incomplete Documents'
    | 'Invalid License'
    | 'Failed Background Check'
    | 'Vehicle Not Eligible'
    | 'Other';
  rejection_reason: string;
}

export interface PointTransaction {
  date: string;
  points_changed: number;
  reason: string | null;
  changed_by_user_id: number | null;
  expires_at: string | null;
}

export interface DriverPointHistory {
  current_points: number;
  history: PointTransaction[];
}

export interface SponsorPointHistoryResponse {
  driver_id: number;
  current_points: number;
  history: PointTransaction[];
  total_count: number;
}

export interface SponsorRewardDefaults {
  dollar_per_point: number;
  earn_rate: number;
  expiration_days: number | null;
  max_points_per_day: number | null;
  max_points_per_month: number | null;
}

export interface PointValueHistoryEntry {
  id: number;
  old_value: number;
  new_value: number;
  changed_by_user_id: number;
  changed_by_username: string | null;
  changed_at: string;
}

export interface PointValueHistoryResponse {
  history: PointValueHistoryEntry[];
}

/* ── Products ── */
export interface Product {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  image?: {
    imageUrl: string;
  };
  rating?: 'G' | 'PG';
}



/* ── API Errors ── */
export interface ApiError {
  status: number;
  message: string;
  detail?: string;
  fieldErrors?: Record<string, string>;
}

