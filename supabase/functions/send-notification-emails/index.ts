// Gửi email cho các thông báo quan trọng đang chờ trong hàng đợi email_outbox (INT-002).
//
// Chạy định kỳ (mỗi phút) bằng Supabase Cron hoặc gọi tay. Mỗi lần lấy tối đa BATCH_SIZE thư.
// Chưa cấu hình nhà cung cấp thì không lấy thư nào: thư nằm chờ, quá email_max_age_hours thì hết hạn.
//
// Biến môi trường (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  Supabase tự cấp
//   EMAIL_PROVIDER      'resend' (mặc định). Thêm nhà cung cấp khác: viết hàm gửi cùng kiểu trong PROVIDERS
//   RESEND_API_KEY      khóa API của Resend
//   EMAIL_FROM          địa chỉ gửi đã xác minh, ví dụ: VibeMapping <thongbao@vibemapping.vn>
//   APP_URL             địa chỉ trang web để dựng đường dẫn trong thư, ví dụ: https://vibemapping.vn
//   CRON_SECRET         (tùy chọn) nếu đặt, lời gọi phải có header x-cron-secret trùng giá trị này
import { createClient } from 'npm:@supabase/supabase-js@2';

const BATCH_SIZE = 20;

interface OutboxRow {
  id: string;
  to_email: string;
  subject: string;
  body_text: string;
  link_path: string | null;
  notification_type: string;
}

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };
type Sender = (mail: Mail) => Promise<SendResult>;

const env = (name: string) => Deno.env.get(name)?.trim() ?? '';

/** Resend: https://resend.com/docs/api-reference/emails/send-email */
function resendSender(apiKey: string, from: string): Sender {
  return async (mail) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: `${response.status} ${JSON.stringify(body).slice(0, 300)}` };
    return { ok: true, messageId: typeof body.id === 'string' ? body.id : null };
  };
}

const PROVIDERS: Record<string, () => Sender | null> = {
  resend: () => {
    const key = env('RESEND_API_KEY');
    const from = env('EMAIL_FROM');
    return key && from ? resendSender(key, from) : null;
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}

/** Thư đơn giản, đọc tốt trên điện thoại; nút mở đúng trang trong ứng dụng */
function buildMail(row: OutboxRow, appUrl: string): Mail {
  const link = row.link_path && appUrl ? new URL(row.link_path, appUrl).toString() : appUrl || null;
  const subject = `${row.subject} · VibeMapping`;
  const lines = [row.subject, row.body_text, link ? `Mở VibeMapping: ${link}` : '', '', 'Bạn nhận thư này vì đã bật email cho loại thông báo này. Tắt trong Hồ sơ cá nhân → Cài đặt thông báo.'];
  const html = `<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Segoe UI,Arial,sans-serif;color:#122">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dfe4ee;border-radius:6px">
<tr><td style="padding:24px 28px">
<p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#1d4ed8">VibeMapping</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.35">${escapeHtml(row.subject)}</h1>
${row.body_text ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334">${escapeHtml(row.body_text)}</p>` : ''}
${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:4px;font-weight:600">Mở VibeMapping</a>` : ''}
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#667">Bạn nhận thư này vì đã bật email cho loại thông báo này. Tắt trong Hồ sơ cá nhân → Cài đặt thông báo.</p>
</td></tr></table></body></html>`;
  return { to: row.to_email, subject, html, text: lines.filter((l, i) => l || i === 3).join('\n') };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  const cronSecret = env('CRON_SECRET');
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'unauthorized' }, 401);

  const providerName = env('EMAIL_PROVIDER') || 'resend';
  const sender = PROVIDERS[providerName]?.() ?? null;
  if (!sender) {
    // Chưa gắn nhà cung cấp: giữ thư trong hàng đợi để gửi khi đã cấu hình
    return json({ skipped: 'provider_not_configured', provider: providerName });
  }

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('claim_email_batch', { p_limit: BATCH_SIZE });
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as OutboxRow[];
  const appUrl = env('APP_URL');
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    let result: SendResult;
    try {
      result = await sender(buildMail(row, appUrl));
    } catch (caught) {
      result = { ok: false, error: caught instanceof Error ? caught.message : String(caught) };
    }
    const { error: completeError } = await admin.rpc('complete_email', {
      p_id: row.id,
      p_ok: result.ok,
      p_error: result.ok ? null : result.error,
      p_message_id: result.ok ? result.messageId : null,
    });
    if (completeError) console.error('complete_email', row.id, completeError.message);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return json({ provider: providerName, claimed: rows.length, sent, failed });
});
