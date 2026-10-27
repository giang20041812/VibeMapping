import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { getProfile, logout } from './auth.service';
import type { UserProfile } from './auth.types';

interface AuthState {
  session: Session | null;
  /** Chưa đăng nhập, hoặc đang là tài khoản ẩn danh của khách làm bài test (chưa gắn email) */
  isGuest: boolean;
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
  /** Tài khoản của hồ sơ đã đọc xong (kể cả đọc lỗi); khác tài khoản đang đăng nhập là hồ sơ chưa đọc xong */
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

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
      setProfileUserId(null);
      return;
    }
    let active = true;
    getProfile(userId)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setProfileUserId(userId);
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

  /*
   * Tính ngay trong lần vẽ: lần vẽ đầu tiên sau khi có phiên (trước khi effect đọc hồ sơ kịp chạy) cũng là đang tải,
   * để trang chặn theo vai trò không coi "chưa có hồ sơ" là "sai vai trò" khi mở thẳng đường dẫn.
   */
  const isProfileLoading = Boolean(userId) && profileUserId !== userId;

  /* Tài khoản ẩn danh đã gắn email thì là tài khoản thật, kể cả khi cờ ẩn danh chưa kịp cập nhật */
  const isGuest = !session || (session.user.is_anonymous === true && !session.user.email);

  const value = useMemo(
    () => ({ session, isGuest, profile, isLoading, isProfileLoading, signOut, refreshProfile }),
    [session, isGuest, profile, isLoading, isProfileLoading, signOut, refreshProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return context;
}
