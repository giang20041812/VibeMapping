import { unwrapRows } from '../../lib/errors.js';
import type { Db } from '../../lib/supabase.js';
import { pageRange, parseAnswerOptions, sanitizeKeyword, type RaterGroup } from './admin.logic.js';

export interface QuestionFilter {
  keyword?: string | undefined;
  groupId?: string | undefined;
  criteriaId?: string | undefined;
  raterGroup?: RaterGroup | undefined;
  assessmentPart?: number | undefined;
  detailLevel?: string | undefined;
  activeState?: 'active' | 'inactive' | undefined;
}

const QUESTION_COLUMNS =
  'id, question_code, criteria_id, rater_group, respondent_segment, question_type, content, answer_options, assessment_part, detail_level, is_active, criteria!inner(dimension_code, name, group_id, criteria_groups!inner(group_code))';

export async function listQuestions(db: Db, filter: QuestionFilter, page: number) {
  let query = db.from('questions').select(QUESTION_COLUMNS, { count: 'exact' });

  const keyword = sanitizeKeyword(filter.keyword ?? '');
  if (keyword) query = query.or(`question_code.ilike.%${keyword}%,content.ilike.%${keyword}%`);
  if (filter.groupId) query = query.eq('criteria.group_id', filter.groupId);
  if (filter.criteriaId) query = query.eq('criteria_id', filter.criteriaId);
  if (filter.raterGroup) query = query.eq('rater_group', filter.raterGroup);
  if (filter.assessmentPart) query = query.eq('assessment_part', filter.assessmentPart);
  if (filter.detailLevel) query = query.eq('detail_level', filter.detailLevel);
  if (filter.activeState) query = query.eq('is_active', filter.activeState === 'active');

  const [from, to] = pageRange(page);
  const result = await query.order('question_code').range(from, to);
  const data = unwrapRows(result);

  const rows = data.map((row) => ({
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
  return { rows, total: result.count ?? 0 };
}
