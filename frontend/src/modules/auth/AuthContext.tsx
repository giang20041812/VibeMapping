import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { getProfile, logout } from './auth.service';
import type { UserProfile } from './auth.types';

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  /** Đang đọc hồ sơ sau khi đăng nhập */
  isProfileLoading: boolean;
  signOut: () => Promise<void>;
  /** Đọc lại hồ sơ từ máy chủ (sau khi người dùng lưu hồ sơ) */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch((error: Error) => console.error('Lỗi đọc phiên đăng nhập:', error.message))
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }
    let active = true;
    setIsProfileLoading(true);
    getProfile(userId)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setIsProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await logout();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfile(await getProfile(userId));
  }, [userId]);

  const value = useMemo(
    () => ({ session, profile, isLoading, isProfileLoading, signOut, refreshProfile }),
    [session, profile, isLoading, isProfileLoading, signOut, refreshProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return context;
}
