import { supabase } from '../../lib/supabase';
import type { InviteGroup } from '../invitation_link/invitation.constants';

export interface GuestInvitation {
  /** own_link: người mở đang đăng nhập đúng tài khoản chủ đường dẫn */
  state: 'valid' | 'expired' | 'revoked' | 'full' | 'not_found' | 'own_link';
  raterGroup: InviteGroup | null;
  subjectDisplayName: string | null;
}

export interface GuestQuestion {
  id: string;
  criteriaName: string;
  content: string;
  answerOptions: string[];
}

export interface GuestAnswer {
  score: number | null;
  insufficient: boolean;
}

export interface GuestSession {
  status: 'draft' | 'pending' | 'accepted' | 'rejected' | 'not_found';
  linkState: 'valid' | 'expired' | 'revoked' | 'own_link' | null;
  subjectDisplayName: string | null;
  startedAt: string | null;
  answers: Map<string, GuestAnswer>;
}

export class GuestError extends Error {
  constructor(public code: 'duplicate' | 'full' | 'unavailable' | 'own' | 'unknown') {
    super(code);
  }
}

export async function getInvitation(token: string): Promise<GuestInvitation> {
  const { data, error } = await supabase.rpc('get_invitation_public', { p_token: token });
  if (error) {
    console.error('Lỗi đọc đường dẫn mời:', error.message);
    throw error;
  }
  const value = data as { state: GuestInvitation['state']; rater_group?: InviteGroup; subject_display_name?: string | null };
  return {
    state: value.state,
    raterGroup: value.rater_group ?? null,
    subjectDisplayName: value.subject_display_name ?? null,
  };
}

export interface IntroForm {
  nickname: string;
  relationship: string;
  duration: number;
  frequency: number;
  depth: number;
}

/** Tạo bài nháp; trả về mã làm tiếp để quay lại sau */
export async function startSubmission(token: string, form: IntroForm): Promise<string> {
  const { data, error } = await supabase.rpc('start_360_submission', {
    p_token: token,
    p_nickname: form.nickname,
    p_relationship: form.relationship,
    p_acquaintance_duration: form.duration,
    p_contact_frequency: form.frequency,
    p_observation_depth: form.depth,
  });
  if (error) {
    const message = error.message ?? '';
    if (message.includes('duplicate_ip')) throw new GuestError('duplicate');
    if (message.includes('link_full')) throw new GuestError('full');
    if (message.includes('invitation_unavailable')) throw new GuestError('unavailable');
    if (message.includes('own_invitation')) throw new GuestError('own');
    console.error('Lỗi tạo bài đánh giá:', message);
    throw new GuestError('unknown');
  }
  return data;
}

export async function getGuestSession(resumeToken: string): Promise<GuestSession> {
  const { data, error } = await supabase.rpc('get_360_session', { p_resume_token: resumeToken });
  if (error) {
    console.error('Lỗi đọc bài làm:', error.message);
    throw error;
  }
  const value = data as {
    status: GuestSession['status'];
    link_state?: GuestSession['linkState'];
    subject_display_name?: string | null;
    started_at?: string;
    answers?: { question_id: string; score: number | null; insufficient: boolean }[];
  };
  return {
    status: value.status,
    linkState: value.link_state ?? null,
    subjectDisplayName: value.subject_display_name ?? null,
    startedAt: value.started_at ?? null,
    answers: new Map((value.answers ?? []).map((a) => [a.question_id, { score: a.score, insufficient: a.insufficient }])),
  };
}

export async function getGuestQuestions(resumeToken: string): Promise<GuestQuestion[]> {
  const { data, error } = await supabase.rpc('get_360_questions', { p_resume_token: resumeToken });
  if (error) {
    console.error('Lỗi đọc câu hỏi:', error.message);
    throw error;
  }
  const rows = (data ?? []) as { question_id: string; criteria_name?: string; content: string; answer_options: string[] | null }[];
  return rows.map((row) => ({
    id: row.question_id,
    criteriaName: row.criteria_name ?? '',
    content: row.content,
    answerOptions: Array.isArray(row.answer_options) ? row.answer_options : [],
  }));
}

export async function saveGuestAnswer(resumeToken: string, questionId: string, answer: GuestAnswer) {
  const { error } = await supabase.rpc('save_360_answers', {
    p_resume_token: resumeToken,
    p_answers: [{ question_id: questionId, score: answer.insufficient ? null : answer.score, insufficient: answer.insufficient }],
  });
  if (error) {
    console.error('Lỗi lưu nháp:', error.message);
    throw error;
  }
}

export interface SubmitResult {
  ok: boolean;
  missingQuestionIds: string[];
}

export async function submitGuest(resumeToken: string): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_360', { p_resume_token: resumeToken });
  if (error) {
    console.error('Lỗi nộp bài:', error.message);
    throw error;
  }
  const value = data as { ok: boolean; missing_question_ids?: string[] };
  return { ok: value.ok, missingQuestionIds: value.missing_question_ids ?? [] };
}
