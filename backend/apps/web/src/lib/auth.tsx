'use client';

import { unwrap } from '@msma/api-client';
import type { SessionUser } from '@msma/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import { applyAppearance } from './appearance';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  setUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  const setUser = useCallback((u: SessionUser) => {
    setUserState(u);
    applyAppearance(u.preferences);
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUserState(null);
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    unwrap(api.GET('/auth/me'))
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await unwrap(api.POST('/auth/login', { body: { email, password } }));
      tokenStore.set(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    [setUser],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, setUser }),
    [user, loading, login, logout, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Roles that use the web dashboard (employees use the mobile app). */
export const WEB_ROLES = ['HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'MANAGER'] as const;
export const canSeePayroll = (role?: string) =>
  role === 'HR_ADMIN' || role === 'PAYROLL_ADMIN' || role === 'SYSTEM_ADMIN';
export const canApprove = (role?: string) =>
  role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN' || role === 'MANAGER';
