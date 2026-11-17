import { supabase } from '../../lib/supabase';

/** Các loại thông báo trong ứng dụng; hàm push_notification kiểm tra in_app_enabled theo từng loại */
export const NOTIFICATION_TYPES = [
  'new_submission',
  'result_changed',
  'result_finalized',
  'link_expiring',
  'class_update',
  'career_ranking_changed',
  'decision_report_shared',
  'decision_consensus',
  'mentor_connection',
  'roadmap_off_track',
  'friend_request',
  'friend_invite',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  new_submission: 'Có bài đánh giá 360° mới',
  result_changed: 'Kết quả thay đổi',
  result_finalized: 'Kết quả được chốt',
  link_expiring: 'Đường dẫn mời sắp hết hạn',
  class_update: 'Cập nhật lớp học',
  career_ranking_changed: 'Thứ hạng nghề thay đổi',
  decision_report_shared: 'Báo cáo quyết định được chia sẻ',
  decision_consensus: 'Gia đình xác nhận đồng thuận',
  mentor_connection: 'Yêu cầu kết nối người hướng dẫn',
  roadmap_off_track: 'Lộ trình chệch hướng',
  friend_request: 'Lời kết bạn',
  friend_invite: 'Bạn bè mời đánh giá 360°',
};

/** Loại được gửi thêm email khi chưa đọc được tham số email_notification_types */
const DEFAULT_EMAIL_TYPES: NotificationType[] = [
  'new_submission', 'result_changed', 'result_finalized', 'link_expiring', 'career_ranking_changed',
  'decision_report_shared', 'mentor_connection', 'friend_invite',
];

export interface NotificationPreference {
  type: NotificationType;
  inApp: boolean;
  email: boolean;
  /** Loại này có gửi email theo cấu hình hệ thống không */
  emailAvailable: boolean;
}

/** Cài đặt từng loại thông báo; loại chưa có dòng cài đặt thì mặc định bật cả hai */
export async function loadNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
  const [settings, param] = await Promise.all([
    supabase.from('notification_settings').select('notification_type, in_app_enabled, email_enabled').eq('user_id', userId),
    supabase.from('operation_parameters').select('param_value').eq('param_code', 'email_notification_types').eq('is_current', true).maybeSingle(),
  ]);
  if (settings.error) throw settings.error;
  const emailTypes = Array.isArray(param.data?.param_value) ? (param.data!.param_value as string[]) : DEFAULT_EMAIL_TYPES;
  const byType = new Map((settings.data ?? []).map((row) => [row.notification_type, row]));
  return NOTIFICATION_TYPES.map((type) => {
    const row = byType.get(type);
    return { type, inApp: row?.in_app_enabled ?? true, email: row?.email_enabled ?? true, emailAvailable: emailTypes.includes(type) };
  });
}

export async function saveNotificationPreference(userId: string, pref: NotificationPreference) {
  const { error } = await supabase.from('notification_settings').upsert(
    { user_id: userId, notification_type: pref.type, in_app_enabled: pref.inApp, email_enabled: pref.email },
    { onConflict: 'user_id,notification_type' },
  );
  if (error) {
    console.error('Lỗi lưu cài đặt thông báo:', error.message);
    throw error;
  }
}

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  read: boolean;
  /** Trang mở khi bấm vào thông báo */
  href: string | null;
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
    .select('id, title, body, payload, created_at, read_at')
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
    href: typeof (row.payload as { href?: unknown } | null)?.href === 'string' ? (row.payload as { href: string }).href : null,
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
