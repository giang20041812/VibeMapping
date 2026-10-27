import { supabase } from '../../lib/supabase';

/** Các loại thông báo trong ứng dụng; hàm push_notification kiểm tra in_app_enabled theo từng loại */
export const NOTIFICATION_TYPES = ['new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'class_update'] as const;

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  read: boolean;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error('Lỗi đổi mật khẩu:', error.message);
    throw error;
  }
}

/** Thông báo được coi là bật khi không có loại nào bị tắt */
export async function getNotificationsEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('notification_type, in_app_enabled')
    .eq('user_id', userId);
  if (error) {
    console.error('Lỗi đọc cài đặt thông báo:', error.message);
    throw error;
  }
  return !(data ?? []).some((row) => row.in_app_enabled === false);
}

export async function setNotificationsEnabled(userId: string, enabled: boolean) {
  const { error } = await supabase.from('notification_settings').upsert(
    NOTIFICATION_TYPES.map((type) => ({ user_id: userId, notification_type: type, in_app_enabled: enabled })),
    { onConflict: 'user_id,notification_type' },
  );
  if (error) {
    console.error('Lỗi lưu cài đặt thông báo:', error.message);
    throw error;
  }
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) {
    console.error('Lỗi đếm thông báo chưa đọc:', error.message);
    throw error;
  }
  return count ?? 0;
}

export async function listNotifications(userId: string, limit = 20): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Lỗi đọc thông báo:', error.message);
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    read: row.read_at !== null,
  }));
}

/** Đánh dấu đã đọc các thông báo trong `ids`; bỏ trống là đánh dấu tất cả thông báo chưa đọc */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (ids) query = query.in('id', ids);
  const { error } = await query;
  if (error) {
    console.error('Lỗi đánh dấu đã đọc:', error.message);
    throw error;
  }
}
