import { supabase } from '../../lib/supabase';
import type { AssessmentResultSummary, GroupScore, ResultStatusLabel } from './assessmentResult.types';

interface GroupScoreRow {
  score_source: string;
  score_percent: number | null;
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

  const [groupsResponse, scoresResponse] = await Promise.all([
    supabase.from('criteria_groups').select('id, group_code, name, sort_order').eq('is_active', true).order('sort_order'),
    supabase
      .from('assessment_result_group_scores')
      .select('group_id, score_source, score_percent')
      .eq('result_id', result.id),
  ]);

  if (groupsResponse.error) {
    console.error('Lỗi đọc nhóm tiêu chí:', groupsResponse.error.message);
    throw groupsResponse.error;
  }
  if (scoresResponse.error) {
    console.error('Lỗi đọc điểm nhóm tiêu chí:', scoresResponse.error.message);
    throw scoresResponse.error;
  }

  const scoresByGroup = new Map<string, GroupScoreRow[]>();
  for (const row of scoresResponse.data ?? []) {
    const list = scoresByGroup.get(row.group_id) ?? [];
    list.push({ score_source: row.score_source, score_percent: row.score_percent === null ? null : Number(row.score_percent) });
    scoresByGroup.set(row.group_id, list);
  }

  const groups: GroupScore[] = (groupsResponse.data ?? []).map((group) => {
    const rows = scoresByGroup.get(group.id) ?? [];
    return {
      groupCode: group.group_code,
      name: group.name,
      sortOrder: group.sort_order,
      self: rows.find((r) => r.score_source === 'self')?.score_percent ?? null,
      combined: rows.find((r) => r.score_source === 'combined_360')?.score_percent ?? null,
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
