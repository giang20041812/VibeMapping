import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase';
import type { LoginInput, RegisterInput, UserProfile } from './auth.types';

const PROFILE_COLUMNS =
  'id, role, full_name, display_name, date_of_birth, school_name, grade_or_major, guardian_consent_confirmed';

export async function registerWithEmail(input: RegisterInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { role: input.role, full_name: input.fullName },
      emailRedirectTo: `${window.location.origin}/dang-nhap`,
    },
  });
  if (error) {
    console.error('Lỗi đăng ký:', error.message);
    throw error;
  }
  return data;
}

export async function loginWithEmail(input: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword(input);
  if (error) {
    console.error('Lỗi đăng nhập:', error.message);
    throw error;
  }
  return data;
}

/** Hỏi Supabase các cách đăng nhập đang bật để chỉ hiển thị nút dùng được */
export async function getEnabledProviders(): Promise<{ google: boolean }> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } });
    if (!response.ok) return { google: false };
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return { google: Boolean(settings.external?.google) };
  } catch {
    return { google: false };
  }
}

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  });
  if (error) {
    console.error('Lỗi đăng nhập Google:', error.message);
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/dang-nhap`,
  });
  if (error) {
    console.error('Lỗi gửi email khôi phục:', error.message);
    throw error;
  }
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Lỗi đăng xuất:', error.message);
    throw error;
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Lỗi đọc phiên đăng nhập:', error.message);
    throw error;
  }
  return data.session;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Lỗi đọc hồ sơ:', error.message);
    throw error;
  }
  return (data as UserProfile | null) ?? null;
}

/** Chuyển lỗi của Supabase Auth sang câu tiếng Việt, nêu rõ nguyên nhân */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng';
  if (message.includes('email not confirmed')) return 'Email chưa được xác minh';
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Email này đã được đăng ký';
  }
  if (message.includes('provider is not enabled')) return 'Đăng nhập bằng Google chưa được bật';
  if (message.includes('rate limit') || message.includes('too many')) return 'Thao tác quá nhiều lần, vui lòng thử lại sau';
  if (message.includes('password')) return 'Mật khẩu chưa đạt yêu cầu';
  if (message.includes('fetch') || message.includes('network')) return 'Không kết nối được máy chủ';
  return 'Có lỗi xảy ra, vui lòng thử lại';
}
