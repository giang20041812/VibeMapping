import type { DisplayGroup, PriorityLevel } from '../../domain/assessmentRules';

/** Nhãn trạng thái kết quả (F01.06) */
export const RESULT_STATUS_LABEL: Record<string, string> = {
  self_assessment: 'Tự đánh giá',
  temporary: 'Tạm thời',
  final_360: 'Cuối cùng 360°',
};

export const RATER_GROUP_LABEL: Record<DisplayGroup, string> = {
  parent: 'Phụ huynh',
  friend: 'Bạn bè',
  teacher: 'Giáo viên',
  mentor: 'Người hướng dẫn',
  others: 'Người khác',
};

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  P1: 'Cao',
  P2: 'Vừa',
  P3: 'Thấp',
};

export const INTEREST_NAME: Record<string, string> = { R: 'Thực tế', I: 'Nghiên cứu', A: 'Nghệ thuật', S: 'Xã hội', E: 'Quản lý', C: 'Nghiệp vụ' };
export const interestLabel = (code: string) => code.split('').map((ch) => INTEREST_NAME[ch] ?? ch).join(' · ');

export const FIT_PARTS = [
  { key: 'g1toG5', label: 'Năng lực' },
  { key: 'g6', label: 'Sở thích' },
  { key: 'g7', label: 'Động lực' },
] as const;

export const PRELIMINARY_NOTE = 'Dữ liệu sơ bộ dựa trên tự đánh giá, cần thêm góc nhìn 360° để kết quả chính xác hơn.';
export const NEAR_FIT_NOTE = 'Chưa tìm thấy nghề đạt ngưỡng phù hợp cao. Các nghề dưới đây gần đạt, cần bổ sung thêm năng lực.';
export const TARGET_LIMIT_NOTE = 'Bạn chỉ được chọn tối đa 02 nghề mục tiêu, vui lòng bỏ chọn bớt một nghề trước khi thêm mới.';
export const FIT_DISCLAIMER = 'Mức phù hợp chỉ mang tính tham khảo, không thay thế quyết định của bạn.';

export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return 'Chưa đủ dữ liệu';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

export function formatScore(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '–';
  return value.toFixed(decimals).replace('.', ',');
}

/** Bước tiếp theo để tăng độ chính xác (BR-015) */
export function nextSurveyStep(input: { statusLabel: string | null; packageSize: number | null; finalized: boolean }):
  { label: string; to: string } | null {
  if (input.statusLabel === 'self_assessment' && !input.finalized) return { label: 'Mời người đánh giá 360°', to: '/danh-gia-360' };
  if (input.packageSize !== null && input.packageSize < 75) {
    return { label: `Làm gói ${input.packageSize < 50 ? 50 : 75} câu`, to: '/danh-gia-360' };
  }
  if (input.statusLabel === 'temporary') return { label: 'Mời thêm người đánh giá', to: '/danh-gia-360' };
  return null;
}
