import { supabase } from '../../lib/supabase';
import type { ShortCriteria, GridData, GridSubmitResult } from './class_assessment_grid.types';

function fail(message: string, error: { message: string }): never {
  console.error(`${message}:`, error.message);
  throw error;
}

export async function getClassGrid(classId: string): Promise<GridData> {
  const { data, error } = await supabase.rpc('get_class_grid', { p_class_id: classId });
  if (error) fail('Lỗi mở bảng lưới', error);
  return data as unknown as GridData;
}

/** Tiêu chí thuộc bộ câu hỏi rút gọn, theo thứ tự nhóm rồi tiêu chí */
export async function listShortSetCriteria(): Promise<ShortCriteria[]> {
  const { data, error } = await supabase
    .from('criteria')
    .select('id, dimension_code, name, sort_order, criteria_groups!inner(group_code, name, sort_order)')
    .eq('is_short_set', true)
    .eq('is_active', true)
    .limit(100);
  if (error) fail('Lỗi đọc bộ câu hỏi rút gọn', error);
  return (data ?? [])
    .map((row: any) => ({
      id: row.id as string,
      dimension_code: row.dimension_code as string,
      name: row.name as string,
      sort_order: row.sort_order as number,
      group_code: row.criteria_groups.group_code as string,
      group_name: row.criteria_groups.name as string,
      group_sort: row.criteria_groups.sort_order as number,
    }))
    .sort((a, b) => a.group_sort - b.group_sort || a.sort_order - b.sort_order);
}

export interface CellChange {
  gridStudentId: string;
  criteriaId: string;
  /** 1–5, 'na' là không đủ cơ sở, null là xóa ô */
  value: number | 'na' | null;
}

export async function saveCells(changes: CellChange[]): Promise<void> {
  const upserts = changes
    .filter((change) => change.value !== null)
    .map((change) => ({
      grid_student_id: change.gridStudentId,
      criteria_id: change.criteriaId,
      score: change.value === 'na' ? null : (change.value as number),
      is_insufficient_basis: change.value === 'na',
    }));
  if (upserts.length > 0) {
    const { error } = await supabase.from('class_assessment_grid_details').upsert(upserts, {
      onConflict: 'grid_student_id,criteria_id',
    });
    if (error) fail('Lỗi lưu điểm', error);
  }
  for (const change of changes.filter((item) => item.value === null)) {
    const { error } = await supabase
      .from('class_assessment_grid_details')
      .delete()
      .eq('grid_student_id', change.gridStudentId)
      .eq('criteria_id', change.criteriaId);
    if (error) fail('Lỗi xóa điểm', error);
  }
}

export interface Understanding {
  acquaintance_duration: number | null;
  contact_frequency: number | null;
  observation_depth: number | null;
}

export async function saveGridDefaults(gridId: string, values: Understanding): Promise<void> {
  const { error } = await supabase
    .from('class_assessment_grids')
    .update({
      default_acquaintance_duration: values.acquaintance_duration,
      default_contact_frequency: values.contact_frequency,
      default_observation_depth: values.observation_depth,
    })
    .eq('id', gridId);
  if (error) fail('Lỗi lưu mức thấu hiểu của lớp', error);
}

export async function saveStudentUnderstanding(gridStudentId: string, values: Understanding): Promise<void> {
  const { error } = await supabase.from('class_assessment_grid_students').update(values).eq('id', gridStudentId);
  if (error) fail('Lỗi lưu mức thấu hiểu của học sinh', error);
}

export async function submitGridStudent(gridStudentId: string): Promise<GridSubmitResult> {
  const { data, error } = await supabase.rpc('submit_class_grid_student', { p_grid_student_id: gridStudentId });
  if (error) {
    if (error.message.includes('short_set_not_configured')) return { ok: false, reason: 'short_set_not_configured' };
    fail('Lỗi nộp điểm học sinh', error);
  }
  return data as unknown as GridSubmitResult;
}
