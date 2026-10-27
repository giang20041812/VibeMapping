import { Brain, Crown, Fingerprint, Flame, Heart, MessagesSquare, Smile, type LucideIcon } from 'lucide-react';
import type { AssessmentResultSummary, CompetencyLevel, ResultStatusLabel } from './assessmentResult.types';

/** Tên rút gọn hiển thị trên nhãn trục của biểu đồ đa giác */
export const GROUP_SHORT_LABELS: Record<string, string> = {
  G1: 'Tính cách',
  G2: 'Tư duy',
  G3: 'Giao tiếp',
  G4: 'Thái độ',
  G5: 'Lãnh đạo',
  G6: 'Sở thích',
  G7: 'Động lực',
};

/** Biểu tượng của từng nhóm tiêu chí trên biểu đồ đa giác */
export const GROUP_ICONS: Record<string, LucideIcon> = {
  G1: Fingerprint,
  G2: Brain,
  G3: MessagesSquare,
  G4: Smile,
  G5: Crown,
  G6: Heart,
  G7: Flame,
};

export const COMPETENCY_LEVELS: { min: number; key: CompetencyLevel; label: string }[] = [
  { min: 80, key: 'very_high', label: 'Rất cao' },
  { min: 65, key: 'high', label: 'Cao' },
  { min: 50, key: 'medium', label: 'Trung bình' },
  { min: 0, key: 'low', label: 'Thấp' },
];

export const NO_DATA_LABEL = 'Chưa đủ dữ liệu';

export const DISCLAIMER_TEXT =
  'Kết quả chỉ mang tính tham khảo định hướng, không phải chẩn đoán tâm lý hay cam kết trúng tuyển.';

/** Bộ khung rỗng để vẽ biểu đồ và bảng điểm khi chưa có kết quả */
export const EMPTY_RESULT: AssessmentResultSummary = {
  id: 'empty',
  statusLabel: 'self_assessment',
  acceptedCount: 0,
  expectedCount: 0,
  groupsCount: 0,
  thinDataFlag: false,
  insufficientBasisWarning: false,
  calculatedAt: null,
  finalizedAt: null,
  groups: [
    { groupCode: 'G1', name: 'Tính cách cá nhân', sortOrder: 1, self: null, combined: null, criteria: [] },
    { groupCode: 'G2', name: 'Tư duy & Năng lực học tập', sortOrder: 2, self: null, combined: null, criteria: [] },
    { groupCode: 'G3', name: 'Giao tiếp & Xã hội', sortOrder: 3, self: null, combined: null, criteria: [] },
    { groupCode: 'G4', name: 'Thái độ & Tinh thần làm việc', sortOrder: 4, self: null, combined: null, criteria: [] },
    { groupCode: 'G5', name: 'Lãnh đạo & Tổ chức', sortOrder: 5, self: null, combined: null, criteria: [] },
    { groupCode: 'G6', name: 'Sở thích cá nhân tương thích giá trị nghề nghiệp', sortOrder: 6, self: null, combined: null, criteria: [] },
    { groupCode: 'G7', name: 'Động lực', sortOrder: 7, self: null, combined: null, criteria: [] },
  ],
};

export function competencyOf(value: number | null) {
  if (value === null) return null;
  return COMPETENCY_LEVELS.find((level) => value >= level.min) ?? COMPETENCY_LEVELS[COMPETENCY_LEVELS.length - 1];
}

export function statusTitle(status: ResultStatusLabel, accepted: number, expected: number): string {
  if (status === 'self_assessment') return 'Tự đánh giá';
  if (status === 'temporary') return `Tạm thời (${accepted}/${expected})`;
  return 'Cuối cùng 360°';
}

export function statusCaption(status: ResultStatusLabel, groupsCount: number): string {
  if (status === 'self_assessment') return 'Đây là kết quả dựa trên đánh giá của chính cá nhân bạn.';
  if (status === 'temporary') return 'Kết quả này vẫn chưa được đánh giá dựa trên toàn cảnh.';
  return `Kết quả dựa trên đánh giá 360° từ ${groupsCount} nhóm đối tượng.`;
}
