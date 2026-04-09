import { api } from './apiClient';
import type { DriverProfile } from '../types';

interface PointHistoryResponse {
  driver_id: number;
  current_points: number;
  history: {
    date: string;
    points_changed: number;
    reason?: string;
    changed_by_user_id?: number;
    expires_at?: string;
  }[];
  total_count: number;
}

export interface DriverApplicationSponsor {
  sponsor_user_id: number;
  sponsor_name: string;
  is_current_sponsor: boolean;
}

export interface DriverApplicationSummary {
  application_id: number;
  sponsor_user_id: number;
  sponsor_name: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateDriverApplicationPayload {
  sponsor_user_id: number;
  license_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_license_plate: string;
}

export const driverService = {
  /** Fetch the authenticated driver's profile */
  getProfile(): Promise<DriverProfile> {
    return api.get<DriverProfile>('/me/profile');
  },

  /** Update the authenticated driver's profile */
  updateProfile(data: Partial<DriverProfile>): Promise<DriverProfile> {
    return api.put<DriverProfile>('/me/profile', data);
  },

  /** Fetch driver's point history */
 getPoints(sponsorId?: number): Promise<PointHistoryResponse> {
    const url = sponsorId
      ? `/api/driver/points/history?sponsor_id=${sponsorId}`
      : '/api/driver/points/history';
    return api.get<PointHistoryResponse>(url);
  },

  getApplicationSponsors(): Promise<DriverApplicationSponsor[]> {
    return api.get<DriverApplicationSponsor[]>('/me/application-sponsors');
  },

  getApplications(): Promise<DriverApplicationSummary[]> {
    return api.get<DriverApplicationSummary[]>('/me/applications');
  },

  createApplication(data: CreateDriverApplicationPayload): Promise<{ message: string; application_id: number; status: string }> {
    return api.post('/me/applications', data);
  },
}
