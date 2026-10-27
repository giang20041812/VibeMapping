import { supabase } from '../../lib/supabase';
import { ADMIN_PAGE_SIZE } from './admin.constants';
import { parseAnswerOptions, sanitizeKeyword } from './admin.logic';
import type { Paged, QuestionFilter, QuestionInput, QuestionRow, RaterGroup } from './admin.types';

export const EMPTY_QUESTION_FILTER: QuestionFilter = {
  keyword: '',
  groupId: '',
  criteriaId: '',
  raterGroup: '',
  assessmentPart: '',
  detailLevel: '',
  activeState: '',
};

const QUESTION_COLUMNS =
  'id, question_code, criteria_id, rater_group, respondent_segment, question_type, content, answer_options, assessment_part, detail_level, is_active, criteria!inner(dimension_code, name, group_id, criteria_groups!inner(group_code))';

export async function listQuestions(
  filter: QuestionFilter,
  page: number,
  fixedRaterGroup?: RaterGroup,
): Promise<Paged<QuestionRow>> {
  let query = supabase.from('questions').select(QUESTION_COLUMNS, { count: 'exact' });

  const keyword = sanitizeKeyword(filter.keyword);
  if (keyword) query = query.or(`question_code.ilike.%${keyword}%,content.ilike.%${keyword}%`);
  if (filter.groupId) query = query.eq('criteria.group_id', filter.groupId);
  if (filter.criteriaId) query = query.eq('criteria_id', filter.criteriaId);
  const raterGroup = fixedRaterGroup ?? filter.raterGroup;
  if (raterGroup) query = query.eq('rater_group', raterGroup as RaterGroup);
  if (filter.assessmentPart) query = query.eq('assessment_part', Number(filter.assessmentPart));
  if (filter.detailLevel) query = query.eq('detail_level', filter.detailLevel);
  if (filter.activeState) query = query.eq('is_active', filter.activeState === 'active');

  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query
    .order('question_code')
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) {
    console.error('Lỗi đọc ngân hàng câu hỏi:', error.message);
    throw error;
  }

  const rows: QuestionRow[] = (data ?? []).map((row) => ({
    id: row.id,
    question_code: row.question_code,
    criteria_id: row.criteria_id,
    dimension_code: row.criteria.dimension_code,
    criteria_name: row.criteria.name,
    group_code: row.criteria.criteria_groups.group_code,
    rater_group: row.rater_group,
    respondent_segment: row.respondent_segment,
    question_type: row.question_type,
    content: row.content,
    answer_options: parseAnswerOptions(row.answer_options),
    assessment_part: row.assessment_part,
    detail_level: row.detail_level,
    is_active: row.is_active,
  }));
  return { rows, total: count ?? 0 };
}

export async function createQuestion(input: QuestionInput): Promise<void> {
  const { error } = await supabase.from('questions').insert(input);
  if (error) {
    console.error('Lỗi thêm câu hỏi:', error.message);
    throw error;
  }
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<void> {
  const { error } = await supabase.from('questions').update(input).eq('id', id);
  if (error) {
    console.error('Lỗi cập nhật câu hỏi:', error.message);
    throw error;
  }
}

export async function setQuestionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('questions').update({ is_active: isActive }).eq('id', id);
  if (error) {
    console.error('Lỗi đổi trạng thái câu hỏi:', error.message);
    throw error;
  }
}

/** Mã câu hỏi đã tồn tại (cột question_code là duy nhất) */
export function isDuplicateQuestionCode(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}
