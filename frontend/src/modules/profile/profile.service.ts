import { supabase } from '../../lib/supabase';

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
