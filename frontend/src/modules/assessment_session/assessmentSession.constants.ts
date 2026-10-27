import type { PackageSize, PartNumber } from './assessmentSession.types';

export const PACKAGES: { size: PackageSize; name: string; minutes: string; note?: string }[] = [
  { size: 35, name: 'Cơ bản', minutes: '6–8 phút', note: 'Kết quả khái quát.' },
  { size: 50, name: 'Tiêu chuẩn', minutes: '10–12 phút' },
  { size: 75, name: 'Chuyên sâu', minutes: '15–18 phút', note: 'Kết quả chi tiết nhất.' },
];

export const DEFAULT_PACKAGE: PackageSize = 50;

export const PARTS: { number: PartNumber; name: string; short: string }[] = [
  { number: 1, name: 'Tính cách', short: 'Tính cách' },
  { number: 2, name: 'Giá trị, động lực', short: 'Giá trị, động lực' },
  { number: 3, name: 'Sở thích nghề nghiệp', short: 'Sở thích' },
  { number: 4, name: 'Năng lực chuyên môn', short: 'Năng lực' },
];

/** Thời gian chờ giữa hai lần làm bài (giờ). Tạm đặt 0 để làm lại liên tục; giá trị chuẩn là 336 (14 ngày) */
export const RETAKE_INTERVAL_HOURS = 0;
/** Thời gian giữ bản nháp (giờ) */
export const DRAFT_RETENTION_HOURS = 168;

export const CORE_VALUE_MIN = 3;
export const CORE_VALUE_MAX = 5;

/** Ngưỡng cảnh báo thiếu dữ liệu: tỷ lệ "không đủ cơ sở" */
export const INSUFFICIENT_WARNING_RATIO = 0.4;

export const SCALE_VALUES = [1, 2, 3, 4, 5] as const;
