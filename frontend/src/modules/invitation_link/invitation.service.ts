import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { CONSENT_QUESTION, DEFAULT_LINK_DAYS } from './invitation.constants';
import type { InviteGroup } from './invitation.constants';

export interface InviteLink {
  id: string;
  group: InviteGroup;
  token: string;
  expectedCount: number;
  expiresAt: string;
  expired: boolean;
  submittedCount: number;
  acceptedCount: number;
}

export type ConsentState = 'unknown' | 'granted' | 'declined';

export interface InviteState {
  resultId: string | null;
  finalized: boolean;
  consent: ConsentState;
  links: InviteLink[];
  expiryDays: number;
}

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export async function getInviteState(userId: string): Promise<InviteState> {
  const [resultResponse, linksResponse, consentResponse, paramResponse] = await Promise.all([
    supabase
      .from('assessment_results')
      .select('id, finalized_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('invitation_links')
      .select('id, rater_group, link_token, expected_count, expires_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('created_at'),
    supabase
      .from('consent_records')
      .select('revoked_at')
      .eq('user_id', userId)
      .eq('consent_type', 'invite_360')
      .order('granted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('operation_parameters').select('param_value').eq('param_code', 'link_expiry_days').eq('is_current', true).maybeSingle(),
  ]);

  for (const response of [resultResponse, linksResponse, consentResponse, paramResponse]) {
    if (response.error) {
      console.error('Lỗi đọc dữ liệu mời đánh giá:', response.error.message);
      throw response.error;
    }
  }

  const links = linksResponse.data ?? [];
  const submissions = links.length
    ? await supabase
        .from('assessment_360_submissions')
        .select('invitation_link_id, status')
        .in(
          'invitation_link_id',
          links.map((l) => l.id),
        )
        .neq('status', 'draft')
    : { data: [], error: null };
  if (submissions.error) {
    console.error('Lỗi đọc bài đã nộp:', submissions.error.message);
    throw submissions.error;
  }

  const expiryValue = paramResponse.data?.param_value;
  const now = Date.now();
  return {
    resultId: resultResponse.data?.id ?? null,
    finalized: Boolean(resultResponse.data?.finalized_at),
    consent: !consentResponse.data ? 'unknown' : consentResponse.data.revoked_at ? 'declined' : 'granted',
    expiryDays: typeof expiryValue === 'number' ? expiryValue : DEFAULT_LINK_DAYS,
    links: links.map((link) => {
      const mine = (submissions.data ?? []).filter((s) => s.invitation_link_id === link.id);
      return {
        id: link.id,
        group: link.rater_group as InviteGroup,
        token: link.link_token,
        expectedCount: link.expected_count,
        expiresAt: link.expires_at,
        expired: new Date(link.expires_at).getTime() <= now,
        submittedCount: mine.length,
        acceptedCount: mine.filter((s) => s.status === 'accepted').length,
      };
    }),
  };
}

/** Ghi lại câu trả lời "đồng ý / không đồng ý" kèm nội dung đã hiển thị */
export async function answerConsent(userId: string, resultId: string | null, agree: boolean) {
  const { error } = await supabase.from('consent_records').insert({
    user_id: userId,
    consent_type: 'invite_360',
    displayed_content: CONSENT_QUESTION,
    revoked_at: agree ? null : new Date().toISOString(),
  });
  if (error) {
    console.error('Lỗi ghi nhận lựa chọn:', error.message);
    throw error;
  }
  if (resultId) await setInviteEnabled(resultId, agree);
}

async function setInviteEnabled(resultId: string, enabled: boolean) {
  const { error } = await supabase.from('assessment_results').update({ invite_enabled: enabled }).eq('id', resultId);
  if (error) {
    console.error('Lỗi cập nhật trạng thái mời:', error.message);
    throw error;
  }
}

/** Tắt việc mời: thu hồi mọi đường dẫn đang mở và ghi nhận thu hồi đồng ý */
export async function disableInvites(userId: string, resultId: string | null) {
  const now = new Date().toISOString();
  const { error: linksError } = await supabase
    .from('invitation_links')
    .update({ revoked_at: now })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (linksError) {
    console.error('Lỗi thu hồi đường dẫn:', linksError.message);
    throw linksError;
  }
  const { error: consentError } = await supabase
    .from('consent_records')
    .update({ revoked_at: now })
    .eq('user_id', userId)
    .eq('consent_type', 'invite_360')
    .is('revoked_at', null);
  if (consentError) {
    console.error('Lỗi thu hồi đồng ý:', consentError.message);
    throw consentError;
  }
  if (resultId) await setInviteEnabled(resultId, false);
}

/** Tạo (hoặc thay) đường dẫn cho từng nhóm: đường dẫn cũ của nhóm đó bị thu hồi trước */
export async function createLinks(userId: string, selections: { group: InviteGroup; count: number }[], days: number) {
  for (const { group, count } of selections) {
    const { error: revokeError } = await supabase
      .from('invitation_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('rater_group', group)
      .is('revoked_at', null);
    if (revokeError) {
      console.error('Lỗi thu hồi đường dẫn cũ:', revokeError.message);
      throw revokeError;
    }
    const { error } = await supabase.from('invitation_links').insert({
      user_id: userId,
      rater_group: group,
      expected_count: count,
      expires_at: daysFromNow(days),
    });
    if (error) {
      console.error('Lỗi tạo đường dẫn mời:', error.message);
      throw error;
    }
  }
}

/** Thu hồi một đường dẫn và tạo ngay đường dẫn mới cho đúng nhóm đó (hạn tính lại từ đầu) */
export async function revokeAndRecreate(userId: string, link: InviteLink, days: number) {
  await createLinks(userId, [{ group: link.group, count: link.expectedCount }], days);
}

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Ảnh mã QR (PNG dạng data URL) của đường dẫn; màu lấy từ token thiết kế */
export function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 640,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: cssColor('--brand-navy'), light: cssColor('--brand-white') },
  });
}
