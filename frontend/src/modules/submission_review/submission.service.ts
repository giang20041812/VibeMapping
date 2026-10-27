import { supabase } from '../../lib/supabase';
import type { InviteGroup } from '../invitation_link/invitation.constants';

export type SubmissionStatus = 'pending' | 'accepted' | 'rejected';

export interface SubmissionRow {
  id: string;
  group: InviteGroup;
  nickname: string | null;
  relationship: string | null;
  understandingScore: number | null;
  trustLabel: 'trusted' | 'consider' | 'suggest_reject' | null;
  trustIndex: number | null;
  qualityFlag: string;
  submittedAt: string | null;
  status: SubmissionStatus;
}

export interface GroupProgress {
  group: InviteGroup;
  expected: number;
  accepted: number;
}

export interface ReviewSummary {
  resultId: string | null;
  finalized: boolean;
  acceptedCount: number;
  thinData: boolean;
  progress: GroupProgress[];
}

export async function listSubmissions(userId: string): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('assessment_360_submissions')
    .select('id, rater_group, rater_nickname, relationship_label, understanding_score, trust_label, trust_index, quality_flag, submitted_at, status')
    .eq('subject_user_id', userId)
    .in('status', ['pending', 'accepted', 'rejected'])
    .order('submitted_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('Lỗi đọc bài đã nộp:', error.message);
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    group: row.rater_group as InviteGroup,
    nickname: row.rater_nickname,
    relationship: row.relationship_label,
    understandingScore: row.understanding_score,
    trustLabel: row.trust_label as SubmissionRow['trustLabel'],
    trustIndex: row.trust_index,
    qualityFlag: row.quality_flag,
    submittedAt: row.submitted_at,
    status: row.status as SubmissionStatus,
  }));
}

export async function getReviewSummary(userId: string, submissions: SubmissionRow[]): Promise<ReviewSummary> {
  const [resultResponse, linksResponse] = await Promise.all([
    supabase
      .from('assessment_results')
      .select('id, finalized_at, accepted_count, thin_data_flag')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('invitation_links').select('rater_group, expected_count').eq('user_id', userId).is('revoked_at', null),
  ]);
  if (resultResponse.error) throw resultResponse.error;
  if (linksResponse.error) throw linksResponse.error;

  const expectedByGroup = new Map<string, number>();
  for (const link of linksResponse.data ?? []) {
    expectedByGroup.set(link.rater_group, (expectedByGroup.get(link.rater_group) ?? 0) + link.expected_count);
  }
  const progress: GroupProgress[] = [...expectedByGroup.entries()].map(([group, expected]) => ({
    group: group as InviteGroup,
    expected,
    accepted: submissions.filter((s) => s.group === group && s.status === 'accepted').length,
  }));

  return {
    resultId: resultResponse.data?.id ?? null,
    finalized: Boolean(resultResponse.data?.finalized_at),
    acceptedCount: resultResponse.data?.accepted_count ?? 0,
    thinData: resultResponse.data?.thin_data_flag ?? false,
    progress,
  };
}

export async function decideSubmission(submissionId: string, decision: 'accepted' | 'rejected') {
  const { error } = await supabase.rpc('decide_submission', { p_submission_id: submissionId, p_decision: decision });
  if (error) {
    console.error('Lỗi lưu quyết định:', error.message);
    throw error;
  }
}

export async function finalizeResult(resultId: string): Promise<{ ok: boolean; thinData: boolean }> {
  const { data, error } = await supabase.rpc('finalize_my_result', { p_result_id: resultId });
  if (error) {
    console.error('Lỗi chốt kết quả:', error.message);
    throw error;
  }
  const value = data as { ok?: boolean; thin_data?: boolean } | null;
  return { ok: Boolean(value?.ok), thinData: Boolean(value?.thin_data) };
}

export const TRUST_LABEL_TEXT: Record<string, string> = {
  trusted: 'Tin cậy',
  consider: 'Cần cân nhắc',
  suggest_reject: 'Đề xuất loại',
};

export const QUALITY_TEXT: Record<string, string> = {
  too_fast: 'Làm quá nhanh',
  uniform_scores: 'Chấm cùng một mức điểm',
  both: 'Làm quá nhanh, chấm cùng một mức điểm',
};

/** Nhãn mức thấu hiểu theo tổng điểm ngữ cảnh (3–12) */
export function understandingLabel(score: number | null): string {
  if (score === null) return '';
  if (score <= 5) return 'Thấu hiểu thấp, cần cân nhắc';
  if (score <= 8) return 'Khá hiểu';
  if (score <= 10) return 'Hiểu rõ';
  return 'Rất thấu hiểu';
}
