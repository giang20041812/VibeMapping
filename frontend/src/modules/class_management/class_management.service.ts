import { supabase } from '../../lib/supabase';
import type {
  ClassMember,
  ClassReport,
  ClassRow,
  JoinedClass,
  RosterImportResult,
  RosterRow,
  School,
  SchoolInvitation,
  SchoolStaffMember,
} from './class_management.types';

function fail(message: string, error: { message: string }): never {
  console.error(`${message}:`, error.message);
  throw error;
}

export async function listSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, school_name, address, city, is_active')
    .order('school_name')
    .limit(500);
  if (error) fail('Lỗi đọc danh sách trường', error);
  return data ?? [];
}

export async function createSchool(input: { school_name: string; address: string | null; city: string | null }): Promise<void> {
  const { error } = await supabase.from('schools').insert(input);
  if (error) fail('Lỗi tạo trường', error);
}

export async function listSchoolStaff(schoolId: string): Promise<SchoolStaffMember[]> {
  const { data, error } = await supabase
    .from('school_staff')
    .select('id, user_id, staff_role')
    .eq('school_id', schoolId)
    .limit(500);
  if (error) fail('Lỗi đọc nhân sự trường', error);
  return (data ?? []) as SchoolStaffMember[];
}

export async function addSchoolStaff(
  schoolId: string,
  email: string,
  staffRole: 'school_admin' | 'teacher',
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('add_school_staff', {
    p_school_id: schoolId,
    p_email: email.trim(),
    p_staff_role: staffRole,
  });
  if (error) fail('Lỗi thêm nhân sự trường', error);
  return data as { ok: boolean; reason?: string };
}

export async function listMySchoolInvitations(): Promise<SchoolInvitation[]> {
  const { data, error } = await supabase.rpc('get_my_school_invitations');
  if (error) fail('Lỗi đọc lời mời làm quản trị trường', error);
  return (data ?? []) as unknown as SchoolInvitation[];
}

export async function confirmSchoolAdmin(schoolId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_school_admin', { p_school_id: schoolId });
  if (error) fail('Lỗi xác nhận quản trị trường', error);
}

export async function listClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, school_id, class_name, grade, school_year, class_code, is_archived')
    .eq('is_archived', false)
    .order('school_year', { ascending: false })
    .order('class_name')
    .limit(500);
  if (error) fail('Lỗi đọc danh sách lớp', error);
  return data ?? [];
}

export async function getClass(classId: string): Promise<ClassRow | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, school_id, class_name, grade, school_year, class_code, is_archived')
    .eq('id', classId)
    .maybeSingle();
  if (error) fail('Lỗi đọc lớp', error);
  return data;
}

export async function createClass(input: {
  schoolId: string;
  className: string;
  grade: number | null;
  schoolYear: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_class', {
    p_school_id: input.schoolId,
    p_class_name: input.className,
    p_grade: input.grade as number,
    p_school_year: input.schoolYear,
  });
  if (error) fail('Lỗi tạo lớp', error);
  return data as string;
}

export async function assignClassTeacher(
  classId: string,
  email: string,
  memberRole: 'homeroom_teacher' | 'subject_teacher',
): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('assign_class_teacher', {
    p_class_id: classId,
    p_email: email.trim(),
    p_member_role: memberRole,
  });
  if (error) fail('Lỗi gán giáo viên', error);
  return data as { ok: boolean; reason?: string };
}

export async function getClassOverview(classId: string): Promise<ClassMember[]> {
  const { data, error } = await supabase.rpc('get_class_overview', { p_class_id: classId });
  if (error) fail('Lỗi đọc thành viên lớp', error);
  return (data ?? []) as unknown as ClassMember[];
}

export async function removeClassMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_class_member', { p_member_id: memberId });
  if (error) fail('Lỗi xóa thành viên lớp', error);
}

export async function importClassRoster(classId: string, rows: RosterRow[]): Promise<RosterImportResult> {
  const { data, error } = await supabase.rpc('import_class_roster', { p_class_id: classId, p_rows: rows.map((item) => ({ ...item })) });
  if (error) fail('Lỗi nhập danh sách học sinh', error);
  return data as unknown as RosterImportResult;
}

export async function joinClassByCode(
  classCode: string,
  studentCode: string,
): Promise<{ ok: boolean; reason?: string; class_name?: string }> {
  const { data, error } = await supabase.rpc('join_class_by_code', {
    p_class_code: classCode.trim(),
    p_student_code: studentCode.trim() || undefined,
  });
  if (error) fail('Lỗi tham gia lớp', error);
  return data as { ok: boolean; reason?: string; class_name?: string };
}

/** Lớp học sinh đang tham gia (RLS chỉ cho đọc lớp mà học sinh là thành viên) */
export async function listJoinedClasses(userId: string): Promise<JoinedClass[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('classes!inner(id, school_id, class_name, grade, school_year, class_code, is_archived, schools(school_name))')
    .eq('user_id', userId)
    .eq('status', 'joined')
    .eq('member_role', 'student')
    .limit(100);
  if (error) fail('Lỗi đọc lớp đã tham gia', error);
  return (data ?? []).map((row: any) => ({
    ...row.classes,
    school_name: row.classes.schools?.school_name ?? null,
  }));
}

export async function leaveClass(memberId: string): Promise<void> {
  await removeClassMember(memberId);
}

export async function findMyMemberId(classId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', classId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail('Lỗi đọc thành viên lớp', error);
  return data?.id ?? null;
}

export async function getClassReport(classId: string): Promise<ClassReport> {
  const { data, error } = await supabase.rpc('get_class_report', { p_class_id: classId });
  if (error) fail('Lỗi đọc báo cáo lớp', error);
  return data as unknown as ClassReport;
}

export async function getSchoolReport(schoolId: string): Promise<ClassReport> {
  const { data, error } = await supabase.rpc('get_school_report', { p_school_id: schoolId });
  if (error) fail('Lỗi đọc báo cáo trường', error);
  return data as unknown as ClassReport;
}
