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

/** Thông tin cá nhân của học sinh / sinh viên; date_of_birth là dd/mm/yyyy khi nhập, yyyy-mm-dd khi gửi lên */
export interface LearnerInfo {
  date_of_birth: string;
  display_name: string;
  school_name: string;
  grade_or_major: string;
}

export type LearnerInfoErrors = Partial<Record<keyof LearnerInfo, string>>;

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  role: RegisterableRole;
  learnerInfo?: LearnerInfo;
}

export interface LoginInput {
  email: string;
  password: string;
}
