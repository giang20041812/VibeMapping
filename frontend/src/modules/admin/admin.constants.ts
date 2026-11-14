import type { SelectOption } from '../../components/common';
import type { FilterOption } from '../../types/filter';
import type { RaterGroup } from './admin.types';

export const ADMIN_PAGE_SIZE = 25;

export const PACKAGE_SIZES = [35, 50, 75] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];

export const PACKAGE_NAMES: Record<PackageSize, string> = {
  35: 'Cơ bản',
  50: 'Tiêu chuẩn',
  75: 'Chuyên sâu',
};

export const RATER_GROUPS: { value: RaterGroup; label: string }[] = [
  { value: 'self', label: 'Bản thân' },
  { value: 'parent', label: 'Phụ huynh' },
  { value: 'friend', label: 'Bạn bè' },
  { value: 'teacher', label: 'Giáo viên' },
  { value: 'mentor', label: 'Người hướng dẫn' },
];

export const RATER_GROUP_LABEL: Record<string, string> = Object.fromEntries(
  RATER_GROUPS.map((group) => [group.value, group.label]),
);

export const RATER_GROUP_OPTIONS: SelectOption[] = RATER_GROUPS.map((group) => ({ ...group }));

export const ASSESSMENT_PART_OPTIONS: FilterOption[] = [
  { value: '1', label: 'Phần 1 – Tính cách' },
  { value: '2', label: 'Phần 2 – Giá trị, động lực' },
  { value: '3', label: 'Phần 3 – Sở thích nghề nghiệp' },
  { value: '4', label: 'Phần 4 – Năng lực chuyên môn' },
];

export const DETAIL_LEVEL_OPTIONS: FilterOption[] = [
  { value: 'overview', label: 'Khái quát' },
  { value: 'detail', label: 'Chi tiết' },
];

export const DETAIL_LEVEL_LABEL: Record<string, string> = Object.fromEntries(
  DETAIL_LEVEL_OPTIONS.map((option) => [option.value, option.label]),
);

export const RESPONDENT_SEGMENT_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'student', label: 'Học sinh' },
  { value: 'university_student', label: 'Sinh viên' },
];

export const ACTIVE_STATE_OPTIONS: FilterOption[] = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'inactive', label: 'Đã ẩn' },
];

export const ANSWER_OPTION_COUNT = 5;
