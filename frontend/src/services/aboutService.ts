import { api } from './apiClient';
import type { AboutInfo } from '../types';

export interface SponsorStat {
  name: string;
  driver_count: number;
}

export interface PublicAboutInfo extends AboutInfo {
  sponsors: SponsorStat[];
}

export const aboutService = {
  getAbout(): Promise<AboutInfo> {
    return api.get<AboutInfo>('/about');
  },
  getPublicAbout(): Promise<PublicAboutInfo> {
    return api.get<PublicAboutInfo>('/about/public');
  },
};
