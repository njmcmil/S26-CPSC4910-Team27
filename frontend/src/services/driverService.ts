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
  getPoints(): Promise<PointHistoryResponse> {
    return api.get<PointHistoryResponse>(
      '/api/driver/points/history'
    );
  }
}