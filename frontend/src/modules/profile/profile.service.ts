import { supabase } from '../../lib/supabase';
import type { UserRole } from '../auth/auth.types';

export interface ProfileUpdate {
  full_name: string;
  date_of_birth: string;
  display_name: string;
  school_name: string;
  grade_or_major: string;
}

export async function updateMyProfile(userId: string, values: ProfileUpdate) {
  const { error } = await supabase.from('user_profiles').update(values).eq('id', userId);
  if (error) {
    console.error('Lỗi lưu hồ sơ:', error.message);
    throw error;
  }
}

/** Đổi giữa học sinh và sinh viên (vai trò không đổi được bằng cập nhật hồ sơ thường) */
export async function setMyLearnerRole(role: Extract<UserRole, 'student' | 'university_student'>) {
  const { error } = await supabase.rpc('set_my_learner_role', { p_role: role });
  if (error) {
    console.error('Lỗi đổi nhóm học sinh / sinh viên:', error.message);
    throw error;
  }
}
