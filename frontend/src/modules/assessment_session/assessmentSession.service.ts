import { supabase } from '../../lib/supabase';
import { DRAFT_RETENTION_HOURS } from './assessmentSession.constants';
import type {
  AnswerMap,
  AssessmentSession,
  BankQuestion,
  CoreValue,
  EvidenceValues,
  PackageSize,
  PartNumber,
} from './assessmentSession.types';

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

// ---------- Ngân hàng câu hỏi ----------

let bankPromise: Promise<BankQuestion[]> | null = null;

/** Toàn bộ câu hỏi tự đánh giá đang bật (khoảng 620 câu); chỉ tải một lần cho mỗi lần mở ứng dụng */
export function loadSelfQuestionBank(): Promise<BankQuestion[]> {
  if (!bankPromise) {
    bankPromise = fetchSelfQuestionBank().catch((error) => {
      bankPromise = null;
      throw error;
    });
  }
  return bankPromise;
}

async function fetchSelfQuestionBank(): Promise<BankQuestion[]> {
  const { data, error } = await supabase
    .from('questions')
    .select(
      'id, question_code, content, answer_options, assessment_part, criteria!inner(id, dimension_code, name, sort_order, holland_code, criteria_groups!inner(group_code, name, sort_order))',
    )
    .eq('rater_group', 'self')
    .eq('is_active', true)
    .not('assessment_part', 'is', null)
    .order('question_code')
    .limit(1000);

  if (error) {
    console.error('Lỗi đọc ngân hàng câu hỏi:', error.message);
    throw error;
  }

  return (data ?? []).map((row) => {
    const criteria = row.criteria;
    const group = criteria.criteria_groups;
    return {
      id: row.id,
      questionCode: row.question_code,
      content: row.content,
      answerOptions: Array.isArray(row.answer_options) ? (row.answer_options as string[]) : [],
      criteriaId: criteria.id,
      dimensionCode: criteria.dimension_code,
      criteriaName: criteria.name,
      criteriaSort: criteria.sort_order,
      groupCode: group.group_code,
      groupName: group.name,
      groupSort: group.sort_order,
      hollandCode: criteria.holland_code,
      part: row.assessment_part as PartNumber,
      round: 0,
    };
  });
}

/** Câu hỏi quản trị đã gán cho gói; rỗng nghĩa là dùng quy tắc chọn tự động */
export async function getPackageAssignments(size: PackageSize): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('question_package_assignments')
    .select('question_id')
    .eq('package_size', size);
  if (error) {
    console.error('Lỗi đọc câu hỏi theo gói:', error.message);
    throw error;
  }
  return new Set((data ?? []).map((row) => row.question_id));
}

// ---------- Phiên làm bài ----------

function toSession(row: {
  id: string;
  package_size: number;
  current_part: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  draft_expires_at: string | null;
}): AssessmentSession {
  return {
    id: row.id,
    packageSize: row.package_size as PackageSize,
    currentPart: row.current_part as PartNumber,
    status: row.status as AssessmentSession['status'],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    draftExpiresAt: row.draft_expires_at,
  };
}

const SESSION_COLUMNS = 'id, package_size, current_part, status, started_at, completed_at, draft_expires_at';

export async function getSession(sessionId: string): Promise<AssessmentSession | null> {
  const { data, error } = await supabase.from('assessment_sessions').select(SESSION_COLUMNS).eq('id', sessionId).maybeSingle();
  if (error) {
    console.error('Lỗi đọc phiên làm bài:', error.message);
    throw error;
  }
  return data ? toSession(data) : null;
}

/** Phiên đang làm dở; bản nháp quá hạn được đánh dấu hết hạn và bỏ qua */
export async function getInProgressSession(userId: string): Promise<AssessmentSession | null> {
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select(SESSION_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('Lỗi đọc phiên đang làm dở:', error.message);
    throw error;
  }
  if (!data) return null;
  if (data.draft_expires_at && new Date(data.draft_expires_at) < new Date()) {
    await supabase.from('assessment_sessions').update({ status: 'expired' }).eq('id', data.id);
    return null;
  }
  return toSession(data);
}

export async function getLatestCompletedSession(userId: string): Promise<AssessmentSession | null> {
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select(SESSION_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('Lỗi đọc phiên đã hoàn thành:', error.message);
    throw error;
  }
  return data ? toSession(data) : null;
}

export async function createSession(userId: string, size: PackageSize): Promise<AssessmentSession> {
  const { data: framework, error: frameworkError } = await supabase
    .from('framework_versions')
    .select('id')
    .eq('is_current', true)
    .single();
  if (frameworkError) {
    console.error('Lỗi đọc phiên bản khung tiêu chí:', frameworkError.message);
    throw frameworkError;
  }

  const { data, error } = await supabase
    .from('assessment_sessions')
    .insert({
      user_id: userId,
      framework_version_id: framework.id,
      package_size: size,
      draft_expires_at: hoursFromNow(DRAFT_RETENTION_HOURS),
    })
    .select(SESSION_COLUMNS)
    .single();
  if (error) {
    console.error('Lỗi tạo phiên làm bài:', error.message);
    throw error;
  }
  return toSession(data);
}

export async function touchSession(sessionId: string, part: PartNumber) {
  const { error } = await supabase
    .from('assessment_sessions')
    .update({ current_part: part, draft_expires_at: hoursFromNow(DRAFT_RETENTION_HOURS) })
    .eq('id', sessionId);
  if (error) console.error('Lỗi lưu tiến độ:', error.message);
}

export async function completeSession(sessionId: string, inviteEnabled = false): Promise<string> {
  const { data, error } = await supabase.rpc('complete_self_assessment', {
    p_session_id: sessionId,
    p_invite_enabled: inviteEnabled,
  });
  if (error) {
    console.error('Lỗi hoàn thành bài đánh giá:', error.message);
    throw error;
  }
  return data;
}

// ---------- Câu trả lời ----------

export async function getAnswers(sessionId: string): Promise<AnswerMap> {
  const { data, error } = await supabase
    .from('assessment_answers')
    .select('question_id, score, is_insufficient_basis')
    .eq('session_id', sessionId)
    .limit(1000);
  if (error) {
    console.error('Lỗi đọc câu trả lời:', error.message);
    throw error;
  }
  return new Map(
    (data ?? []).map((row) => [row.question_id, { score: row.score, insufficient: row.is_insufficient_basis }]),
  );
}

/** Lưu ngay sau mỗi câu; "không đủ cơ sở" lưu điểm rỗng (NULL), không phải 0 */
export async function saveAnswer(
  sessionId: string,
  question: Pick<BankQuestion, 'id' | 'criteriaId'>,
  value: { score: number | null; insufficient: boolean },
) {
  const { error } = await supabase.from('assessment_answers').upsert(
    {
      session_id: sessionId,
      question_id: question.id,
      criteria_id: question.criteriaId,
      score: value.insufficient ? null : value.score,
      is_insufficient_basis: value.insufficient,
    },
    { onConflict: 'session_id,question_id' },
  );
  if (error) {
    console.error('Lỗi lưu câu trả lời:', error.message);
    throw error;
  }
}

// ---------- Giá trị cốt lõi ----------

export async function getCoreValues(): Promise<CoreValue[]> {
  const { data, error } = await supabase
    .from('core_values')
    .select('id, value_code, name')
    .eq('is_active', true)
    .order('sort_order');
  if (error) {
    console.error('Lỗi đọc giá trị cốt lõi:', error.message);
    throw error;
  }
  return (data ?? []).map((row) => ({ id: row.id, code: row.value_code, name: row.name }));
}

/** Danh sách id giá trị đã chọn, theo thứ tự ưu tiên */
export async function getSessionCoreValues(sessionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('assessment_core_values')
    .select('core_value_id, priority_rank')
    .eq('session_id', sessionId)
    .order('priority_rank');
  if (error) {
    console.error('Lỗi đọc giá trị đã chọn:', error.message);
    throw error;
  }
  return (data ?? []).map((row) => row.core_value_id);
}

export async function saveSessionCoreValues(sessionId: string, orderedIds: string[]) {
  const { error: deleteError } = await supabase.from('assessment_core_values').delete().eq('session_id', sessionId);
  if (deleteError) {
    console.error('Lỗi xóa giá trị cũ:', deleteError.message);
    throw deleteError;
  }
  const { error } = await supabase.from('assessment_core_values').insert(
    orderedIds.map((id, index) => ({ session_id: sessionId, core_value_id: id, priority_rank: index + 1 })),
  );
  if (error) {
    console.error('Lỗi lưu giá trị cốt lõi:', error.message);
    throw error;
  }
}

// ---------- Minh chứng bổ trợ ----------

const splitLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export async function saveEvidence(sessionId: string, values: EvidenceValues) {
  const average = values.gradePointAverage.trim().replace(',', '.');
  const { error } = await supabase.from('assessment_evidences').upsert(
    {
      session_id: sessionId,
      grade_point_average: average ? Number(average) : null,
      certificates: splitLines(values.certificates),
      achievements: splitLines(values.achievements),
    },
    { onConflict: 'session_id' },
  );
  if (error) {
    console.error('Lỗi lưu minh chứng:', error.message);
    throw error;
  }
}

export async function getEvidence(sessionId: string): Promise<EvidenceValues> {
  const { data, error } = await supabase
    .from('assessment_evidences')
    .select('grade_point_average, certificates, achievements')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) {
    console.error('Lỗi đọc minh chứng:', error.message);
    throw error;
  }
  const lines = (value: unknown) => (Array.isArray(value) ? (value as string[]).join('\n') : '');
  return {
    gradePointAverage: data?.grade_point_average === null || data?.grade_point_average === undefined ? '' : String(data.grade_point_average),
    certificates: lines(data?.certificates),
    achievements: lines(data?.achievements),
  };
}

/** Bỏ chọn "không đủ cơ sở" (hoặc xóa câu trả lời): câu quay về trạng thái chưa trả lời */
export async function deleteAnswer(sessionId: string, questionId: string) {
  const { error } = await supabase.from('assessment_answers').delete().eq('session_id', sessionId).eq('question_id', questionId);
  if (error) {
    console.error('Lỗi xóa câu trả lời:', error.message);
    throw error;
  }
}
