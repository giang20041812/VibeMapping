import type { UserProfile, UserRole } from '../auth/auth.types';

export const GUARDIAN_AGE = 16;

/** Vai trò làm bài tự đánh giá và mời đánh giá 360° */
export function isLearnerRole(role: UserRole | undefined): boolean {
  return role === 'student' || role === 'university_student';
}

export function groupLabel(role: UserRole | undefined): string {
  return role === 'university_student' ? 'Sinh viên' : 'Học sinh';
}

export const GRADE_OPTIONS: Record<'student' | 'university_student', string[]> = {
  student: ['Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12'],
  university_student: ['Năm 1', 'Năm 2', 'Năm 3', 'Năm 4', 'Mới đi làm'],
};

/** Hồ sơ đã đủ thông tin bắt buộc để dùng chức năng đánh giá */
export function isProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (!isLearnerRole(profile.role)) return Boolean(profile.full_name);
  return Boolean(
    profile.full_name && profile.date_of_birth && profile.display_name && profile.school_name && profile.grade_or_major,
  );
}

export function ageOf(dateOfBirth: string | null, today = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Dưới 16 tuổi và chưa có xác nhận của người giám hộ thì khóa chức năng mời đánh giá */
export function isInviteLocked(profile: UserProfile | null): boolean {
  const age = ageOf(profile?.date_of_birth ?? null);
  return age !== null && age < GUARDIAN_AGE && !profile?.guardian_consent_confirmed;
}

/** dd/mm/yyyy -> yyyy-mm-dd; trả về null nếu không hợp lệ */
export function parseVietnameseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date > new Date() || year < 1900) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatVietnameseDate(isoDate: string | null): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

/** Tên hiển thị: tối đa 20 ký tự, chỉ chữ, số, khoảng trắng, gạch ngang và gạch dưới */
export function validateDisplayName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'Nhập tên hiển thị';
  if (name.length > 20) return 'Tên hiển thị tối đa 20 ký tự';
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) return 'Tên hiển thị không chứa ký tự đặc biệt';
  return undefined;
}
