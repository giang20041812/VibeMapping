import { supabase } from '../../lib/supabase';
import { getLatestAssessmentResult } from '../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../assessment_result/assessmentResult.types';
import { getAnswers, getInProgressSession, getLatestCompletedSession, getPackageAssignments, loadSelfQuestionBank } from '../assessment_session/assessmentSession.service';
import { PARTS, RETAKE_INTERVAL_HOURS } from '../assessment_session/assessmentSession.constants';
import type { AssessmentSession } from '../assessment_session/assessmentSession.types';
import { selectQuestions } from '../assessment_session/selectQuestions';
import { computeProgress } from '../assessment_session/sessionProgress';

export interface HomeSummary {
  inProgress: AssessmentSession | null;
  /** Ví dụ: "câu 6/14 của phần Giá trị, động lực" */
  progressText: string | null;
  retakeAt: string | null;
  completedAt: string | null;
  result: AssessmentResultSummary | null;
  activeLinks: number;
  pendingSubmissions: number;
}

export async function getHomeSummary(userId: string): Promise<HomeSummary> {
  const [inProgress, completed, result, linksResponse, pendingResponse] = await Promise.all([
    getInProgressSession(userId),
    getLatestCompletedSession(userId),
    getLatestAssessmentResult(userId),
    supabase
      .from('invitation_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()),
    supabase
      .from('assessment_360_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('subject_user_id', userId)
      .eq('status', 'pending'),
  ]);

  if (linksResponse.error) console.error('Lỗi đọc đường dẫn mời:', linksResponse.error.message);
  if (pendingResponse.error) console.error('Lỗi đọc bài chờ duyệt:', pendingResponse.error.message);

  let progressText: string | null = null;
  if (inProgress) {
    const [bank, assigned, answers] = await Promise.all([
      loadSelfQuestionBank(),
      getPackageAssignments(inProgress.packageSize),
      getAnswers(inProgress.id),
    ]);
    const progress = computeProgress(selectQuestions(bank, inProgress.packageSize, assigned), answers);
    if (progress.currentPart) {
      const part = progress.parts.find((p) => p.part === progress.currentPart);
      const name = PARTS.find((p) => p.number === progress.currentPart)?.name ?? '';
      progressText = `câu ${progress.currentIndex + 1}/${part?.total ?? 0} của phần ${name}`;
    } else {
      progressText = 'đã trả lời hết câu hỏi, còn bước hoàn thành';
    }
  }

  let retakeAt: string | null = null;
  if (!inProgress && completed?.completedAt) {
    const next = new Date(new Date(completed.completedAt).getTime() + RETAKE_INTERVAL_HOURS * 3_600_000);
    if (next > new Date()) retakeAt = next.toISOString();
  }

  return {
    inProgress,
    progressText,
    retakeAt,
    completedAt: completed?.completedAt ?? null,
    result,
    activeLinks: linksResponse.count ?? 0,
    pendingSubmissions: pendingResponse.count ?? 0,
  };
}
