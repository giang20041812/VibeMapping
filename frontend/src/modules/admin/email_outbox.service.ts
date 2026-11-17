import { callRpc, db } from '../../lib/rpc';

export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'expired';

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  pending: 'Chờ gửi',
  sending: 'Đang gửi',
  sent: 'Đã gửi',
  failed: 'Lỗi',
  expired: 'Hết hạn',
};

export interface EmailOutboxSummary {
  counts: Partial<Record<EmailStatus, number>>;
  last_sent_at: string | null;
  oldest_pending_at: string | null;
}

export interface EmailOutboxRow {
  id: string;
  to_email: string;
  subject: string;
  status: EmailStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

export const loadEmailOutboxSummary = () => callRpc<EmailOutboxSummary>('email_outbox_summary');

/** Thư cần chú ý: lỗi hoặc đang chờ, mới nhất trước */
export async function listEmailIssues(limit = 10): Promise<EmailOutboxRow[]> {
  const { data, error } = await db
    .from('email_outbox')
    .select('id, to_email, subject, status, attempts, last_error, created_at')
    .in('status', ['failed', 'pending'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EmailOutboxRow[];
}

export const retryFailedEmails = () => callRpc<number>('retry_failed_emails');
