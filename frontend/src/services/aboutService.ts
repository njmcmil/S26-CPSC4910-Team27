import { api } from './apiClient';
import type { AboutInfo } from '../types';

export const aboutService = {
  getAbout(): Promise<AboutInfo> {
    return api.get<AboutInfo>('/about');
  },
};