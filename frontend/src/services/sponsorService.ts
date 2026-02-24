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
   Base URLs
===================== */

const PROFILE_BASE = '/sponsor/profile';
const APPLICATIONS_BASE = '/sponsor/applications';
const CATALOG_BASE = '/api/sponsor/catalog';

/* =====================
   Sponsor Service
===================== */

export const sponsorService = {

  /* ---------------- PROFILE ---------------- */

  getProfile(): Promise<SponsorProfile> {
    return api.get(PROFILE_BASE);
  },

  updateProfile(data: SponsorProfileUpdate): Promise<SponsorProfile> {
    return api.put(PROFILE_BASE, data);
  },

  /* ---------------- APPLICATIONS ---------------- */

  getPendingApplications(): Promise<DriverApplication[]> {
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

  /* ---------------- CATALOG ---------------- */

  getCatalog(): Promise<any> {
    return api.get(CATALOG_BASE);
  },

  addToCatalog(product: any) {
    return api.post(CATALOG_BASE, product);
  },

  removeFromCatalog(itemId: string) {
    return api.delete(`${CATALOG_BASE}/${itemId}`);
  }
};