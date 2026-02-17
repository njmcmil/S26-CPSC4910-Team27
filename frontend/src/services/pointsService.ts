import { api } from './apiClient';
import type {
  DriverPointHistory,
  SponsorPointHistoryResponse,
  SponsorRewardDefaults,
} from '../types';

export interface PointTransaction {
  transaction_id: number;
  points_change: number;
  reason: string;
  created_at: string;
  transaction_type: 'earned' | 'redeemed' | 'adjustment';
}

export interface PointsData {
  current_balance: number;
  transactions: PointTransaction[];
}

export interface PointChangeRequest {
  driver_id: number;
  points: number;
  reason: string;
}

export interface PointChangeResponse {
  success: boolean;
  message: string;
  new_total: number;
}

export const pointsService = {
  /**
   * Get current points balance and transaction history for the authenticated driver
   */
  getPoints(): Promise<PointsData> {
    return api.get<PointsData>('/api/points/me');
  },

  /**
   * get driver's complete point history including expires_at 
   */
  getDriverPointHistory(): Promise<DriverPointHistory> {
    return api.get<DriverPointHistory>('/api/driver/points/history');
  },

  /**
   * sponsor fetches a specific driver's point history
   */
  getSponsorDriverPointHistory(
    driverId: number,
    params?: { start_date?: string; end_date?: string; limit?: number; offset?: number },
  ): Promise<SponsorPointHistoryResponse> {
    const query = new URLSearchParams();
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const qs = query.toString();
    return api.get<SponsorPointHistoryResponse>(
      `/api/sponsor/drivers/${driverId}/point-history${qs ? `?${qs}` : ''}`,
    );
  },

  /**
   * get sponsor reward defaults
   */
  getSponsorRewardDefaults(): Promise<SponsorRewardDefaults> {
    return api.get<SponsorRewardDefaults>('/api/sponsor/reward-defaults');
  },

  /**
   * update sponsor reward defaults
   */
  updateSponsorRewardDefaults(defaults: SponsorRewardDefaults): Promise<{ success: boolean }> {
    return api.put<{ success: boolean }>('/api/sponsor/reward-defaults', defaults);
  },

  /** Sponsor adds points to a driver */
  addPoints(data: PointChangeRequest): Promise<PointChangeResponse> {
    return api.post<PointChangeResponse>('/api/sponsor/points/add', data);
  },

  /** Sponsor deducts points from a driver */
  deductPoints(data: PointChangeRequest): Promise<PointChangeResponse> {
    return api.post<PointChangeResponse>('/api/sponsor/points/deduct', data);
  },
};
