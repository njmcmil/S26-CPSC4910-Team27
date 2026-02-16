import { api } from './apiClient';

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

export const pointsService = {
  /**
   * Get current points balance and transaction history for the authenticated driver
   */
  getPoints(): Promise<PointsData> {
    return api.get<PointsData>('/api/points/me');
  },
};
