import { supabase } from '../../lib/supabase';
import { normalizeSearchText } from '../../lib/searchText';
import type { Paged } from '../school_explorer/school_explorer.types';
import type { MajorFilter, MajorRow } from './major_explorer.types';

export const MAJOR_PAGE_SIZE = 24;

export const EMPTY_MAJOR_FILTER: MajorFilter = { keyword: '', fieldId: '', city: '' };

/** Chữ khóa tìm kiếm: bỏ dấu để khớp cột normalized_name, bỏ ký tự làm hỏng bộ lọc PostgREST */
const searchKeyword = (keyword: string) => normalizeSearchText(keyword).replace(/[,()"\\%_*]/g, ' ').trim();

/** Ngành đào tạo kèm số chương trình; lọc theo lĩnh vực, tỉnh/thành của trường có đào tạo ngành đó */
export async function listMajors(filter: MajorFilter, page: number): Promise<Paged<MajorRow>> {
  const bySchool = Boolean(filter.fieldId || filter.city);
  const select = bySchool
    ? 'id, major_name, programs:training_programs(count), match:training_programs!inner(school:institutions!inner(main_field_id, city))'
    : 'id, major_name, programs:training_programs(count)';
  let query = supabase.from('majors').select(select, { count: 'exact' }).eq('is_active', true);

  const keyword = searchKeyword(filter.keyword);
  if (keyword) query = query.ilike('normalized_name', `%${keyword}%`);
  if (filter.fieldId) query = query.eq('match.school.main_field_id', filter.fieldId);
  if (filter.city) query = query.eq('match.school.city', filter.city);

  const from = (page - 1) * MAJOR_PAGE_SIZE;
  const { data, error, count } = await query.order('major_name', { ascending: true }).range(from, from + MAJOR_PAGE_SIZE - 1);
  if (error) {
    console.error('Lỗi đọc danh sách ngành:', error.message);
    throw error;
  }

  type Raw = { id: string; major_name: string; programs: { count: number }[] | null };
  const rows: MajorRow[] = ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    major_name: row.major_name,
    program_count: row.programs?.[0]?.count ?? 0,
  }));
  return { rows, total: count ?? 0 };
}
