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
};