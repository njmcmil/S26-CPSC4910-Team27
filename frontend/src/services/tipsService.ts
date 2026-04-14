import { api } from './apiClient';

export interface Tip {
  tip_id: number;
  tip_text: string;
  category?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const tipsService = {
  async getTips(): Promise<Tip[]> {
    return await api.get<Tip[]>('/api/tips');
  },

  async getSponsorTips(): Promise<Tip[]> {
    return await api.get<Tip[]>('/api/sponsor/tips');
  },

  async markViewed(tipId: number): Promise<void> {
    await api.post('/api/tips/view', {
      tip_id: tipId,
    });
  },

  async createTip(data: {
    tip_text: string;
    category?: string;
    active: boolean;
  }): Promise<Tip> {
    return await api.post<Tip>('/api/tips', data);
  },

  async disableSponsorTip(tipId: number): Promise<Tip> {
    return await api.put<Tip>(`/api/sponsor/tips/${tipId}/disable`);
  },

  async enableSponsorTip(tipId: number): Promise<Tip> {
    return await api.put<Tip>(`/api/sponsor/tips/${tipId}/enable`);
  },

  async deleteSponsorTip(tipId: number): Promise<{ success: boolean }> {
    return await api.delete<{ success: boolean }>(`/api/sponsor/tips/${tipId}`);
  },
};
