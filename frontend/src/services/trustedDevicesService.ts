import { api } from './apiClient';
import type { TrustedDevice } from '../types';

const BASE = '/me/trusted-devices'; 

export const trustedDevicesService = {
  /** Fetch the list of trusted devices for the authenticated user */
  list(): Promise<TrustedDevice[]> {
    return api.get<TrustedDevice[]>(BASE);
  },

  /** Revoke / remove a single trusted device by ID */
  revoke(deviceId: string | number): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`${BASE}/${deviceId}`);
  },
};
