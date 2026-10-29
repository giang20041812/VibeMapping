import { supabase } from '../../lib/supabase';
import { getPackageAssignments, loadSelfQuestionBank } from '../assessment_session/assessmentSession.service';
import type { PackageSize } from '../assessment_session/assessmentSession.types';
import { selectQuestions } from '../assessment_session/selectQuestions';
import type { GridData, GridSubmitResult } from './class_assessment_grid.types';

function fail(message: string, error: { message: string }): never {
  console.error(`${message}:`, error.message);
  throw error;
}

export async function getClassGrid(classId: string): Promise<GridData> {
  const { data, error } = await supabase.rpc('get_class_grid', { p_class_id: classId });
  if (error) fail('Lỗi mở bảng lưới', error);
  return data as unknown as GridData;
}

/**
 * Câu hỏi của gói, chọn đúng như bài tự đánh giá của học sinh; bỏ câu thuộc tiêu chí giáo viên không chấm.
 * Thứ tự trả về là thứ tự cột của bảng.
 */
async function packageQuestionIds(size: PackageSize): Promise<string[]> {
  const [bank, assigned, hidden] = await Promise.all([
    loadSelfQuestionBank(),
    getPackageAssignments(size),
    supabase.from('criteria_rater_visibility').select('criteria_id').eq('rater_group', 'teacher').eq('is_visible', false),
  ]);
  if (hidden.error) fail('Lỗi đọc ma trận thang đo', hidden.error);
  const hiddenIds = new Set((hidden.data ?? []).map((row) => row.criteria_id));
  return selectQuestions(bank, size, assigned)
    .filter((question) => !hiddenIds.has(question.criteriaId))
    .map((question) => question.id);
}

/** Chọn gói câu hỏi cho bảng; câu không còn trong gói mới thì bỏ đáp án đã chấm */
export async function setGridPackage(gridId: string, size: PackageSize): Promise<void> {
  const questionIds = await packageQuestionIds(size);
  const { error } = await supabase.rpc('set_grid_package', {
    p_grid_id: gridId,
    p_package_size: size,
    p_question_ids: questionIds,
  });
  if (error) fail('Lỗi chọn gói câu hỏi', error);
}

export interface CellChange {
  gridStudentId: string;
  questionId: string;
  /** 1–5, 'na' là không đủ cơ sở, null là xóa ô */
  value: number | 'na' | null;
}

export async function saveCells(changes: CellChange[]): Promise<void> {
  const upserts = changes
    .filter((change) => change.value !== null)
    .map((change) => ({
      grid_student_id: change.gridStudentId,
      question_id: change.questionId,
      score: change.value === 'na' ? null : (change.value as number),
      is_insufficient_basis: change.value === 'na',
    }));
  if (upserts.length > 0) {
    const { error } = await supabase.from('class_assessment_grid_details').upsert(upserts, {
      onConflict: 'grid_student_id,question_id',
    });
    if (error) fail('Lỗi lưu điểm', error);
  }
  for (const change of changes.filter((item) => item.value === null)) {
    const { error } = await supabase
      .from('class_assessment_grid_details')
      .delete()
      .eq('grid_student_id', change.gridStudentId)
      .eq('question_id', change.questionId);
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

export async function submitGrid(gridId: string): Promise<GridSubmitResult> {
  const { data, error } = await supabase.rpc('submit_class_grid', { p_grid_id: gridId });
  if (error) {
    if (error.message.includes('grid_already_submitted')) return { ok: false, reason: 'already_submitted' };
    fail('Lỗi nộp bảng điểm', error);
  }
  return data as unknown as GridSubmitResult;
}
