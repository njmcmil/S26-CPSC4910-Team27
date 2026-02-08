import { api } from './apiClient';
import type { LoginRequest, LoginResponse } from '../types';

export const authService = {
  /** POST /login — backend returns { user_id, username, role, email, access_token } */
  login(data: LoginRequest): Promise<LoginResponse> {
    // NOTE: backend currently accepts { username, password }.
    // "remember_device" is sent but the backend may ignore it until
    // the trusted-devices feature is wired up on the server side.
    return api.post<LoginResponse>('/login', data);
  },

  /** POST /logout — invalidates the current JWT */
  logout(): Promise<{ message: string }> {
    return api.post<{ message: string }>('/logout');
  },

  // TODO: confirm if a /me or /users/me endpoint exists for
  // fetching the current user from a stored token on page reload.
  // For now the skeleton stores the login response in memory/localStorage.
};
