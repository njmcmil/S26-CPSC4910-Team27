import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, LoginRequest, UserRole } from '../types';
import { authService } from '../services/authService';
import { setToken } from '../services/apiClient';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<UserRole>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = 'gdip_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { user: AuthUser; token: string };
        setToken(stored.token);
        setUser(stored.user);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (data: LoginRequest): Promise<UserRole> => {
    const res = await authService.login(data);
    const authUser: AuthUser = {
      user_id: res.user_id,
      username: res.username,
      role: res.role,
      email: res.email,
    };
    setToken(res.access_token);
    setUser(authUser);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: authUser, token: res.access_token }),
    );
    return res.role;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // If the server rejects (e.g. expired token), still clear local state
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
