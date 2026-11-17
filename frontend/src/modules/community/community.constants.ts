import type { CareerEvent, ConnectionStatus, EventDraft, PostType } from './community.types';

export type EventState = 'registered' | 'open' | 'full' | 'closed' | 'past';

/** Trạng thái đăng ký của một sự kiện với người đang xem */
export function eventState(event: CareerEvent, now = Date.now()): EventState {
  if (new Date(event.starts_at).getTime() < now) return 'past';
  if (event.registered) return 'registered';
  if (event.registration_deadline && new Date(event.registration_deadline).getTime() < now) return 'closed';
  if (event.seat_limit !== null && event.registrations >= event.seat_limit) return 'full';
  return 'open';
}

export const EVENT_STATE_LABEL: Record<EventState, string> = {
  registered: 'Đã đăng ký',
  open: 'Còn nhận đăng ký',
  full: 'Hết chỗ',
  closed: 'Hết hạn đăng ký',
  past: 'Đã diễn ra',
};

export const EVENT_STATE_VARIANT: Record<EventState, 'success' | 'info' | 'warning' | 'default'> = {
  registered: 'success',
  open: 'info',
  full: 'warning',
  closed: 'default',
  past: 'default',
};

/** Chữ viết tắt trên ảnh đại diện: "Nguyễn Văn An" → "NA" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export const POST_TYPE_LABEL: Record<PostType, string> = {
  post: 'Bài viết',
  question: 'Hỏi đáp',
};

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  pending: 'Đang chờ',
  accepted: 'Đã chấp nhận',
  declined: 'Đã từ chối',
};

export const CONNECTION_STATUS_VARIANT: Record<ConnectionStatus, 'default' | 'success' | 'danger'> = {
  pending: 'default',
  accepted: 'success',
  declined: 'danger',
};

export const EMPTY_EVENT_DRAFT: EventDraft = {
  title: '', description: '', location: '', audience: '', startsAt: '', seatLimit: '', deadline: '',
};

/** Lỗi máy chủ thành câu dễ hiểu */
export function communityErrorText(caught: unknown, fallback: string): string {
  const message = String((caught as { message?: string })?.message ?? '');
  if (message.includes('under_guardian_age')) return 'Học sinh dưới 16 tuổi chưa được gửi yêu cầu kết nối 1-1 với người hướng dẫn.';
  if (message.includes('reason_required') || message.includes('content_reports_reason_check')) return 'Lý do báo cáo cần ít nhất 8 ký tự.';
  if (message.includes('content_reports_unique')) return 'Bạn đã báo cáo bài này.';
  if (message.includes('invalid_name')) return 'Tên nhóm cần ít nhất 3 ký tự.';
  if (message.includes('event_full')) return 'Sự kiện đã hết chỗ.';
  if (message.includes('registration_closed')) return 'Đã quá hạn đăng ký sự kiện.';
  if (message.includes('invalid_deadline')) return 'Hạn đăng ký phải trước giờ diễn ra.';
  if (message.includes('invalid_event')) return 'Nhập tên sự kiện từ 3 ký tự và thời gian diễn ra.';
  if (message.includes('author_restricted')) return 'Bạn đang tạm thời không được đăng bài hoặc bình luận trong nhóm này.';
  if (message.includes('headline_required')) return 'Giới thiệu ngắn cần ít nhất 8 ký tự.';
  if (message.includes('mentor_not_verified')) return 'Người hướng dẫn chưa được xác minh.';
  return fallback;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** "3 phút trước", "Hôm qua", ngày đầy đủ khi đã lâu */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}
