import { api } from './apiClient';
import type { DriverProfile } from '../types';

export const driverService = {
  /** Fetch the authenticated driver's profile */
  getProfile(): Promise<DriverProfile> {
    return api.get<DriverProfile>('/me/profile');
  },

  /** Update the authenticated driver's profile */
  updateProfile(data: Partial<DriverProfile>): Promise<DriverProfile> {
    return api.put<DriverProfile>('/me/profile', data);
  },
};
