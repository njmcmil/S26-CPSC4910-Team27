import { api } from './apiClient';

export interface PointTransaction {
  date: string;
  points_changed: number;
  reason: string;
  changed_by_user_id: number;
}

export interface PointsData {
  current_balance: number;
  transactions: PointTransaction[];
}

export const pointsService = {
  /**
   * Get current points balance and transaction history for the authenticated driver
   * Calls GET /driver/points/history
   */
  async getPoints(): Promise<PointsData> {
    const data = await api.get<{ current_points: number; history: PointTransaction[] }>(
      '/api/driver/points/history'
    );
    return {
      current_balance: data.current_points,
      transactions: data.history,
    };
  },
};
