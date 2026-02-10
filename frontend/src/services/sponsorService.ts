import { api } from './apiClient';
import type { SponsorProfile, SponsorProfileUpdate } from '../types';

const PROFILE_BASE = '/sponsor/profile';
const APPLICATIONS_BASE = '/sponsor/applications';

export const sponsorService = {
  /* =====================
     PROFILE
  ===================== */
  getProfile(): Promise<SponsorProfile> {
    return api.get<SponsorProfile>(PROFILE_BASE);
  },

  updateProfile(data: SponsorProfileUpdate): Promise<SponsorProfile> {
    return api.put<SponsorProfile>(PROFILE_BASE, data);
  },

  /* =====================
     APPLICATIONS
  ===================== */
  getPendingApplications() {
    return api.get(`${APPLICATIONS_BASE}?status=pending`);
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
