import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserDTO } from '@heartbeat/shared';
import * as authApi from '../api/auth.js';

interface AuthState {
  user: UserDTO | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(() => {
    const stored = localStorage.getItem('heartbeat_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('heartbeat_token')
  );
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.login(username, password);
      setUser(result.user);
      setToken(result.token);
      localStorage.setItem('heartbeat_token', result.token);
      localStorage.setItem('heartbeat_user', JSON.stringify(result.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('heartbeat_token');
    localStorage.removeItem('heartbeat_user');
  }, []);

  // Verify token on mount
  useEffect(() => {
    if (token) {
      authApi.getMe().catch(() => logout());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
