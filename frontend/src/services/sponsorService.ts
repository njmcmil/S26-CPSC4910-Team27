import { api } from './apiClient';
import type { SponsorProfile, SponsorProfileUpdate } from '../types';

/* =====================
   Types
===================== */
export interface DriverApplication {
  application_id: number;
  driver_user_id: number;
  username: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

/* =====================
   Backend Base URL
===================== */
const PROFILE_BASE = '/sponsor/profile';
const APPLICATIONS_BASE = '/sponsor/applications';

/* =====================
   Sponsor Service
===================== */
export const sponsorService = {
  /* Profile */
  getProfile(): Promise<SponsorProfile> {
    return api.get(PROFILE_BASE);
  },

  updateProfile(data: SponsorProfileUpdate): Promise<SponsorProfile> {
    return api.put(PROFILE_BASE, data);
  },

  /* Applications */
  getPendingApplications(): Promise<DriverApplication[]> {
    // This now hits the GET /applications endpoint on the EC2 backend
    return api.get(`${APPLICATIONS_BASE}?status=pending`) as Promise<DriverApplication[]>;
  },

  approveApplication(applicationId: number) {
    return api.post(`${APPLICATIONS_BASE}/${applicationId}/approve`);
  },

  rejectApplication(
    applicationId: number,
    rejection_category:
      | 'Incomplete Documents'
      | 'Invalid License'
      | 'Failed Background Check'
      | 'Vehicle Not Eligible'
      | 'Other',
    rejection_reason: string
  ) {
    return api.post(`${APPLICATIONS_BASE}/${applicationId}/reject`, {
      rejection_category,
      rejection_reason,
    });
  },
};
