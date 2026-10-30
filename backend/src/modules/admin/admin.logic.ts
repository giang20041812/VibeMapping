export const ADMIN_PAGE_SIZE = 25;
export const ANSWER_OPTION_COUNT = 5;
export const PACKAGE_SIZES = [35, 50, 75] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];
export const RATER_GROUPS = ['self', 'parent', 'friend', 'teacher', 'mentor'] as const;
export type RaterGroup = (typeof RATER_GROUPS)[number];

/** Giờ Việt Nam: ngày người dùng chọn trong bộ lọc tính theo múi giờ này, không theo múi giờ máy chủ */
const LOCAL_OFFSET = '+07:00';

/** Bỏ ký tự làm hỏng cú pháp bộ lọc `or()` của PostgREST */
export function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[,()"\\%_*]/g, ' ').trim();
}

/** Đáp án lưu dạng JSON (mảng 5 nhãn); dữ liệu cũ sai dạng thì trả mảng rỗng đủ 5 ô */
export function parseAnswerOptions(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : String(item ?? ''))) : [];
  return Array.from({ length: ANSWER_OPTION_COUNT }, (_, index) => list[index] ?? '');
}

/** Ngày yyyy-mm-dd → mốc đầu ngày dạng ISO */
export function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00${LOCAL_OFFSET}`).toISOString();
}

export function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999${LOCAL_OFFSET}`).toISOString();
}

export function displayPersonName(profile: { full_name: string | null; display_name: string | null } | null): string | null {
  if (!profile) return null;
  return profile.full_name || profile.display_name || null;
}

export function pageRange(page: number): [number, number] {
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  return [from, from + ADMIN_PAGE_SIZE - 1];
}
