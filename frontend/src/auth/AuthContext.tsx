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

const TOKEN_KEY = 'gdip_auth';

/** Save auth to the chosen storage and remove from the other. */
function saveAuth(token: string, user: AuthUser, remember: boolean) {
  const payload = JSON.stringify({ user, token });
  if (remember) {
    localStorage.setItem(TOKEN_KEY, payload);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, payload);
    localStorage.removeItem(TOKEN_KEY);
  }
}

/** Load auth preferring sessionStorage first, then localStorage. */
function loadAuth(): { user: AuthUser; token: string } | null {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const raw = storage.getItem(TOKEN_KEY);
      if (raw) {
        return JSON.parse(raw) as { user: AuthUser; token: string };
      }
    } catch {
      storage.removeItem(TOKEN_KEY);
    }
  }
  return null;
}

/** Clear auth from both storages. */
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const stored = loadAuth();
    if (stored) {
      setToken(stored.token);
      setUser(stored.user);
    }
    setLoading(false);
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
    saveAuth(res.access_token, authUser, !!data.remember_device);
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
    clearAuth();
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
