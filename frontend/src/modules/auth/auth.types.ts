export type UserRole =
  | 'student'
  | 'university_student'
  | 'parent'
  | 'teacher'
  | 'mentor'
  | 'school_admin'
  | 'system_admin';

/** Vai trò được phép tự chọn khi đăng ký */
export type RegisterableRole = Extract<UserRole, 'student' | 'university_student' | 'parent' | 'teacher' | 'mentor'>;

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string | null;
  display_name: string | null;
  date_of_birth: string | null;
  school_name: string | null;
  grade_or_major: string | null;
  guardian_consent_confirmed: boolean;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  role: RegisterableRole;
}

export interface LoginInput {
  email: string;
  password: string;
}
