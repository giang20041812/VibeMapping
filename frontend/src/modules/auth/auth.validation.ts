import { parseVietnameseDate, validateDisplayName } from '../profile/profile.logic';
import type { LearnerInfo, LearnerInfoErrors } from './auth.types';

const EMAIL_PATTERN =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RULES = [
  { key: 'length', label: '8 ký tự', test: (v: string) => v.length >= 8 },
  { key: 'upper', label: 'Chữ hoa', test: (v: string) => /\p{Lu}/u.test(v) },
  { key: 'lower', label: 'Chữ thường', test: (v: string) => /\p{Ll}/u.test(v) },
  { key: 'digit', label: 'Số', test: (v: string) => /\d/.test(v) },
] as const;

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Nhập email';
  if (!EMAIL_PATTERN.test(value.trim())) return 'Email không hợp lệ';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Nhập mật khẩu';
  if (!PASSWORD_RULES.every((rule) => rule.test(value))) return 'Mật khẩu chưa đạt yêu cầu';
  return undefined;
}

export function validateFullName(value: string): string | undefined {
  if (!value.trim()) return 'Nhập họ và tên';
  return undefined;
}

export function validateLearnerInfo(values: LearnerInfo): LearnerInfoErrors {
  const dateOfBirth = values.date_of_birth.trim();
  return {
    date_of_birth: !dateOfBirth ? 'Nhập ngày sinh' : parseVietnameseDate(dateOfBirth) ? undefined : 'Ngày sinh không hợp lệ',
    display_name: validateDisplayName(values.display_name),
    school_name: values.school_name.trim() ? undefined : 'Nhập trường',
    grade_or_major: values.grade_or_major ? undefined : 'Chọn khối lớp hoặc ngành học',
  };
}
