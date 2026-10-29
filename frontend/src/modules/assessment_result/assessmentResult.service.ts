import { supabase } from '../../lib/supabase';
import type { AssessmentResultSummary, CriterionScore, GroupScore, ResultStatusLabel } from './assessmentResult.types';

interface ScoreRow {
  score_source: string;
  score_percent: number | null;
}

function groupRows<T extends { score_source: string; score_percent: number | string | null }>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, ScoreRow[]> {
  const map = new Map<string, ScoreRow[]>();
  for (const row of rows) {
    const list = map.get(keyOf(row)) ?? [];
    list.push({ score_source: row.score_source, score_percent: row.score_percent === null ? null : Number(row.score_percent) });
    map.set(keyOf(row), list);
  }
  return map;
}

function percentOf(rows: ScoreRow[], source: string): number | null {
  return rows.find((r) => r.score_source === source)?.score_percent ?? null;
}

/** Kết quả mới nhất của một HS/SV cùng điểm từng nhóm tiêu chí; null nếu chưa có kết quả */
export async function getLatestAssessmentResult(userId: string): Promise<AssessmentResultSummary | null> {
  const { data: result, error } = await supabase
    .from('assessment_results')
    .select(
      'id, status_label, accepted_count, expected_count, groups_count, thin_data_flag, insufficient_basis_warning, calculated_at, finalized_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Lỗi đọc kết quả đánh giá:', error.message);
    throw error;
  }
  if (!result) return null;

  const [groupsResponse, scoresResponse, criteriaResponse, criteriaScoresResponse] = await Promise.all([
    supabase.from('criteria_groups').select('id, group_code, name, sort_order').eq('is_active', true).order('sort_order'),
    supabase
      .from('assessment_result_group_scores')
      .select('group_id, score_source, score_percent')
      .eq('result_id', result.id),
    supabase.from('criteria').select('id, group_id, dimension_code, name, sort_order').eq('is_active', true).order('sort_order'),
    supabase
      .from('assessment_result_scores')
      .select('criteria_id, score_source, score_percent')
      .eq('result_id', result.id)
      .in('score_source', ['self', 'combined_360']),
  ]);

  if (groupsResponse.error) {
    console.error('Lỗi đọc nhóm tiêu chí:', groupsResponse.error.message);
    throw groupsResponse.error;
  }
  if (scoresResponse.error) {
    console.error('Lỗi đọc điểm nhóm tiêu chí:', scoresResponse.error.message);
    throw scoresResponse.error;
  }
  if (criteriaResponse.error) {
    console.error('Lỗi đọc tiêu chí:', criteriaResponse.error.message);
    throw criteriaResponse.error;
  }
  if (criteriaScoresResponse.error) {
    console.error('Lỗi đọc điểm tiêu chí:', criteriaScoresResponse.error.message);
    throw criteriaScoresResponse.error;
  }

  const scoresByGroup = groupRows(scoresResponse.data ?? [], (row) => row.group_id);
  const scoresByCriterion = groupRows(criteriaScoresResponse.data ?? [], (row) => row.criteria_id);

  const criteriaByGroup = new Map<string, CriterionScore[]>();
  for (const criterion of criteriaResponse.data ?? []) {
    const rows = scoresByCriterion.get(criterion.id) ?? [];
    const list = criteriaByGroup.get(criterion.group_id) ?? [];
    list.push({
      dimensionCode: criterion.dimension_code,
      name: criterion.name,
      sortOrder: criterion.sort_order,
      self: percentOf(rows, 'self'),
      combined: percentOf(rows, 'combined_360'),
    });
    criteriaByGroup.set(criterion.group_id, list);
  }

  const groups: GroupScore[] = (groupsResponse.data ?? []).map((group) => {
    const rows = scoresByGroup.get(group.id) ?? [];
    return {
      groupCode: group.group_code,
      name: group.name,
      sortOrder: group.sort_order,
      self: percentOf(rows, 'self'),
      combined: percentOf(rows, 'combined_360'),
      criteria: criteriaByGroup.get(group.id) ?? [],
    };
  });

  return {
    id: result.id,
    statusLabel: result.status_label as ResultStatusLabel,
    acceptedCount: result.accepted_count,
    expectedCount: result.expected_count,
    groupsCount: result.groups_count,
    thinDataFlag: result.thin_data_flag,
    insufficientBasisWarning: result.insufficient_basis_warning,
    calculatedAt: result.calculated_at,
    finalizedAt: result.finalized_at,
    groups,
  };
}
