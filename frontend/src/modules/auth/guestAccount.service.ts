import { supabase } from '../../lib/supabase';
import { describeAuthError } from './auth.service';

/**
 * Khách làm bài test không cần đăng nhập: tạo tài khoản ẩn danh để bài làm được lưu như người dùng thường.
 * Đã có phiên (ẩn danh hay thật) thì dùng lại.
 */
export async function ensureGuestSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Lỗi tạo phiên cho khách:', error.message);
    throw error;
  }
}

export function describeGuestError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('anonymous')) return 'Chưa mở được bài test cho khách, vui lòng đăng nhập hoặc đăng ký';
  return describeAuthError(error);
}

export interface GuestAccountInput {
  fullName: string;
  email: string;
  password: string;
}

/**
 * Gắn email và mật khẩu vào chính tài khoản ẩn danh: mã người dùng giữ nguyên nên bài đã làm không mất.
 * Trả về true khi Supabase còn chờ người dùng bấm xác nhận trong email mới coi là tài khoản thật.
 */
export async function upgradeGuestAccount(input: GuestAccountInput): Promise<{ needsEmailConfirmation: boolean }> {
  const { error } = await supabase.auth.updateUser(
    { email: input.email, password: input.password, data: { full_name: input.fullName } },
    { emailRedirectTo: `${window.location.origin}/dang-nhap` },
  );
  if (error) {
    console.error('Lỗi tạo tài khoản cho khách:', error.message);
    throw error;
  }
  // Đọc lại từ máy chủ: email chỉ có giá trị khi đã xác nhận (đang chờ xác nhận thì nằm ở new_email)
  const { data, error: readError } = await supabase.auth.getUser();
  if (readError) {
    console.error('Lỗi đọc lại tài khoản:', readError.message);
    throw readError;
  }
  return { needsEmailConfirmation: !data.user.email };
}
