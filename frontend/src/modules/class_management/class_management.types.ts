export interface School {
  id: string;
  school_name: string;
  address: string | null;
  city: string | null;
  is_active: boolean;
}

export interface SchoolStaffMember {
  id: string;
  user_id: string;
  staff_role: 'school_admin' | 'teacher';
}

export interface SchoolInvitation {
  school_id: string;
  school_name: string;
}

export interface ClassRow {
  id: string;
  school_id: string;
  class_name: string;
  grade: number | null;
  school_year: string;
  class_code: string;
  is_archived: boolean;
}

export type MemberRole = 'homeroom_teacher' | 'subject_teacher' | 'student';
export type MemberStatus = 'invited' | 'joined' | 'left' | 'removed';

export interface ClassMember {
  member_id: string;
  member_role: MemberRole;
  status: MemberStatus;
  user_id: string | null;
  full_name: string;
  student_code: string | null;
  has_result: boolean;
  is_graded: boolean;
  guardian_pending: boolean;
}

export interface RosterRow {
  row: number;
  student_code: string;
  full_name: string;
  /** yyyy-mm-dd; rỗng nếu tệp không điền */
  date_of_birth: string;
}

export interface RosterRowError {
  row: number;
  reason: string;
  student_code?: string;
}

export type RosterAccountOutcome = 'created' | 'linked_existing' | 'error';

export interface RosterAccount {
  student_code: string;
  full_name: string;
  email: string;
  /** Chỉ có khi vừa tạo tài khoản mới, và chỉ trả về một lần */
  password: string | null;
  outcome: RosterAccountOutcome;
  reason?: string;
}

export interface RosterImportResult {
  imported: number;
  errors: RosterRowError[];
}

export interface ReportGroup {
  group_code: string;
  name: string;
  average_percent: number | null;
}

export type ClassReport =
  | { ok: true; student_count: number; joined_count: number; member_count: number; graded_count?: number; groups: ReportGroup[] }
  | { ok: false; reason: 'below_threshold'; student_count: number; joined_count: number; member_count: number; graded_count?: number };

export interface JoinedClass extends ClassRow {
  school_name: string | null;
}
