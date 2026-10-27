import { ANSWER_OPTION_COUNT } from './admin.constants';

/** Bỏ ký tự làm hỏng cú pháp bộ lọc `or()` của PostgREST */
export function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[,()"\\%_*]/g, ' ').trim();
}

/** Đáp án lưu dạng JSON (mảng 5 nhãn); dữ liệu cũ sai dạng thì trả mảng rỗng đủ 5 ô */
export function parseAnswerOptions(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : String(item ?? ''))) : [];
  return Array.from({ length: ANSWER_OPTION_COUNT }, (_, index) => list[index] ?? '');
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ngày yyyy-mm-dd của ô chọn ngày → mốc đầu ngày (giờ địa phương) dạng ISO */
export function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export function displayPersonName(profile: { full_name: string | null; display_name: string | null } | null): string | null {
  if (!profile) return null;
  return profile.full_name || profile.display_name || null;
}
