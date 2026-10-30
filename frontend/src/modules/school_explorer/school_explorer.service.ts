import { supabase } from '../../lib/supabase';
import { normalizeSearchText } from '../../lib/searchText';
import type { FilterOption } from '../../types/filter';
import { SCHOOL_PAGE_SIZE } from './school_explorer.constants';
import type { InstitutionFilter, InstitutionRow, InstitutionType, Ownership, Paged } from './school_explorer.types';

export const EMPTY_INSTITUTION_FILTER: InstitutionFilter = {
  keyword: '',
  city: '',
  ownership: '',
  institutionType: '',
  fieldId: '',
  majorId: '',
};

const READ_PAGE = 1000;

/** Chữ khóa tìm kiếm: bỏ dấu để khớp cột normalized_name, bỏ ký tự làm hỏng bộ lọc PostgREST */
const searchKeyword = (keyword: string) => normalizeSearchText(keyword).replace(/[,()"\\%_*]/g, ' ').trim();

export async function listInstitutions(filter: InstitutionFilter, page: number): Promise<Paged<InstitutionRow>> {
  // Lọc theo ngành: nối trong (inner) sang chương trình đào tạo của ngành đó
  const select = filter.majorId
    ? 'id, institution_name, institution_type, ownership, city, website_url, field:career_fields!institutions_main_field_id_fkey(field_name), programs:training_programs(count), match:training_programs!inner(major_id)'
    : 'id, institution_name, institution_type, ownership, city, website_url, field:career_fields!institutions_main_field_id_fkey(field_name), programs:training_programs(count)';
  let query = supabase.from('institutions').select(select, { count: 'exact' }).neq('institution_type', 'parent_university');

  const keyword = searchKeyword(filter.keyword);
  if (keyword) query = query.ilike('normalized_name', `%${keyword}%`);
  if (filter.city) query = query.eq('city', filter.city);
  if (filter.ownership) query = query.eq('ownership', filter.ownership);
  if (filter.institutionType) query = query.eq('institution_type', filter.institutionType);
  if (filter.fieldId) query = query.eq('main_field_id', filter.fieldId);
  if (filter.majorId) query = query.eq('match.major_id', filter.majorId);

  const from = (page - 1) * SCHOOL_PAGE_SIZE;
  const { data, error, count } = await query
    .order('segment_rank', { ascending: true, nullsFirst: false })
    .order('institution_name', { ascending: true })
    .range(from, from + SCHOOL_PAGE_SIZE - 1);
  if (error) {
    console.error('Lỗi đọc danh sách trường:', error.message);
    throw error;
  }

  type Raw = {
    id: string;
    institution_name: string;
    institution_type: string;
    ownership: string | null;
    city: string | null;
    website_url: string | null;
    field: { field_name: string } | null;
    programs: { count: number }[] | null;
  };
  const rows: InstitutionRow[] = ((data ?? []) as unknown as Raw[]).map((row) => ({
    id: row.id,
    institution_name: row.institution_name,
    institution_type: row.institution_type as InstitutionType,
    ownership: row.ownership as Ownership | null,
    city: row.city,
    website_url: row.website_url,
    field_name: row.field?.field_name ?? null,
    program_count: row.programs?.[0]?.count ?? 0,
  }));
  return { rows, total: count ?? 0 };
}

/** Đọc hết một bảng danh mục (PostgREST giới hạn 1000 dòng mỗi lần) */
async function readAllNames<Row>(read: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += READ_PAGE) {
    const { data, error } = await read(from, from + READ_PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < READ_PAGE) return rows;
  }
}

export async function listCityOptions(): Promise<FilterOption[]> {
  try {
    const rows = await readAllNames((from, to) =>
      supabase.from('institutions').select('city').neq('institution_type', 'parent_university').not('city', 'is', null).order('id').range(from, to),
    );
    const cities = Array.from(new Set(rows.map((row) => row.city as string))).sort((a, b) => a.localeCompare(b, 'vi'));
    return cities.map((city) => ({ value: city, label: city }));
  } catch (error) {
    console.error('Lỗi đọc danh sách tỉnh/thành:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/** Lĩnh vực cấp 1 (LV1–LV6) */
export async function listFieldOptions(): Promise<FilterOption[]> {
  const { data, error } = await supabase.from('career_fields').select('id, field_name').is('parent_field_id', null).order('sort_order');
  if (error) {
    console.error('Lỗi đọc danh sách lĩnh vực:', error.message);
    throw error;
  }
  return (data ?? []).map((row) => ({ value: row.id, label: row.field_name }));
}

export async function listMajorOptions(): Promise<FilterOption[]> {
  try {
    const rows = await readAllNames((from, to) => supabase.from('majors').select('id, major_name').eq('is_active', true).order('major_name').range(from, to));
    return rows.map((row) => ({ value: row.id, label: row.major_name }));
  } catch (error) {
    console.error('Lỗi đọc danh sách ngành:', error instanceof Error ? error.message : error);
    throw error;
  }
}
