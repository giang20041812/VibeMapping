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

/** Nơi đến sau khi làm xong bài: khách và hồ sơ còn thiếu phải khai báo nốt, đủ rồi thì xem kết quả */
export function pathAfterTest(isGuest: boolean, profile: UserProfile | null): string {
  return isGuest || !isProfileComplete(profile) ? '/hoan-tat-ho-so' : '/danh-gia-360';
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

/** dd/mm/yyyy (hoặc ddmmyyyy) -> yyyy-mm-dd; trả về null nếu không hợp lệ */
export function parseVietnameseDate(value: string): string | null {
  const trimmed = value.trim();
  let day: number;
  let month: number;
  let year: number;

  const matchDelimited = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (matchDelimited) {
    day = Number(matchDelimited[1]);
    month = Number(matchDelimited[2]);
    year = Number(matchDelimited[3]);
  } else {
    const matchRawDigits = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (!matchRawDigits) return null;
    day = Number(matchRawDigits[1]);
    month = Number(matchRawDigits[2]);
    year = Number(matchRawDigits[3]);
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date > new Date() || year < 1900) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Tự động định dạng ngày sinh dd/mm/yyyy khi người dùng gõ số */
export function formatDateInput(value: string, prevValue = ''): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  // Nếu đã đủ 8 chữ số (vd người dùng dán '18122004' hoặc gõ xong năm)
  if (digits.length === 8) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }

  // Trường hợp người dùng đang bấm Backspace / xóa
  if (value.length < prevValue.length) {
    if (prevValue.endsWith('/') && value === prevValue.slice(0, -1)) {
      return value.slice(0, -1);
    }
    return value;
  }

  // Người dùng chủ động gõ dấu '/' sau 1 chữ số ngày hoặc tháng (vd: 5/ -> 05/)
  if (value.endsWith('/')) {
    const parts = value.split('/').filter((p, i, arr) => i < arr.length - 1 || p.length > 0);
    if (parts.length === 1 && /^\d$/.test(parts[0])) {
      return `0${parts[0]}/`;
    }
    if (parts.length === 2 && /^\d$/.test(parts[1])) {
      return `${parts[0]}/0${parts[1]}/`;
    }
  }

  if (!digits) return '';

  if (digits.length < 2) {
    return digits;
  }
  if (digits.length === 2) {
    return `${digits}/`;
  }
  if (digits.length < 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
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
