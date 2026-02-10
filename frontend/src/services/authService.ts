import { api } from './apiClient';
import type { LoginRequest, LoginResponse, ChangePasswordRequest } from '../types';

export const authService = {
  /** POST /login — backend returns { user_id, username, role, email, access_token } */
  login(data: LoginRequest): Promise<LoginResponse> {
    return api.post<LoginResponse>('/login', data);
  },

  logout(): Promise<{ message: string }> {
    return api.post<{ message: string }>('/logout');
  },

  /** POST /change-password — changes the current user's password */
  changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    return api.post<{ message: string }>('/change-password', data);
  },

  /** POST /logout — invalidates the current JWT */
  forgotPassword(username: string): Promise<{ message: string }> {
    return api.post<{ message: string }>('/forgot-password', { username });
  },
};
