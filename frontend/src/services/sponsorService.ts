import { api } from './apiClient';
import type { SponsorProfile, SponsorProfileUpdate } from '../types';

const BASE = '/sponsor/profile'; 

export const sponsorService = {
  /** Fetch the authenticated sponsor's profile */
  getProfile(): Promise<SponsorProfile> {
    return api.get<SponsorProfile>(BASE);
  },

  /** Update the sponsor profile */
  updateProfile(data: SponsorProfileUpdate): Promise<SponsorProfile> {
    return api.put<SponsorProfile>(BASE, data);
  },
};
