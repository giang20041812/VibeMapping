import type { SelectOption } from '../../components/common';
import type { CareerStatus, CheckedKind } from './career_admin.types';

export const CAREER_STATUS_OPTIONS: SelectOption[] = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'review', label: 'Đang rà soát' },
  { value: 'published', label: 'Đã công bố' },
  { value: 'hidden', label: 'Đã ẩn' },
];

export const CAREER_STATUS_LABEL: Record<CareerStatus, string> = {
  draft: 'Bản nháp',
  review: 'Đang rà soát',
  published: 'Đã công bố',
  hidden: 'Đã ẩn',
};

export const CAREER_STATUS_VARIANT: Record<CareerStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  draft: 'default',
  review: 'warning',
  published: 'success',
  hidden: 'danger',
};

export const CHECKED_KIND_OPTIONS: SelectOption[] = [
  { value: 'checked', label: 'Ngày kiểm tra' },
  { value: 'posted', label: 'Ngày đăng tin' },
];

export const CHECKED_KIND_LABEL: Record<CheckedKind, string> = {
  checked: 'Kiểm tra',
  posted: 'Đăng tin',
};

export const COMPLETE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'complete', label: 'Đủ 3 thành phần' },
  { value: 'incomplete', label: 'Thiếu thành phần' },
];

export const REVIEW_FILTER_OPTIONS: SelectOption[] = [
  { value: 'stale', label: 'Quá hạn rà soát' },
  { value: 'fresh', label: 'Còn hạn' },
  { value: 'none', label: 'Chưa có ngày' },
];

export const HOLLAND_LETTERS = ['R', 'I', 'A', 'S', 'E', 'C'] as const;

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create_career: 'Tạo nghề',
  update_career: 'Sửa thông tin',
  update_career_requirements: 'Sửa mức yêu cầu',
  update_career_holland: 'Sửa hồ sơ Holland',
  set_career_status: 'Đổi trạng thái',
  auto_publish_careers: 'Tự công bố',
};

export const VERIFICATION_LABEL: Record<string, string> = {
  demo: 'Demo',
  per_document: 'Theo tài liệu',
  per_jd_data: 'Theo dữ liệu JD',
  expert_reviewed: 'Chuyên gia duyệt',
  calibrated: 'Đã hiệu chỉnh',
};

export const CAREER_ADMIN_PAGE_SIZE = 25;
export const DEFAULT_REVIEW_MONTHS = 6;

export const formatDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');
