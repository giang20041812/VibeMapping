import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Alert, Badge, Button, Card, DataTable } from '../../../components/common';
import type { DataTableColumn } from '../../../components/common';
import { formatDateTime } from '../admin.logic';
import {
  EMAIL_STATUS_LABEL,
  listEmailIssues,
  loadEmailOutboxSummary,
  retryFailedEmails,
  type EmailOutboxRow,
  type EmailOutboxSummary,
  type EmailStatus,
} from '../email_outbox.service';
import './EmailOutboxCard.css';

const SUMMARY_ORDER: EmailStatus[] = ['pending', 'sent', 'failed', 'expired'];
const STATUS_VARIANT: Record<EmailStatus, 'default' | 'success' | 'danger' | 'warning' | 'info'> = {
  pending: 'info',
  sending: 'info',
  sent: 'success',
  failed: 'danger',
  expired: 'default',
};
/** Thư chờ quá 15 phút mà chưa có lần gửi nào: nhiều khả năng chưa gắn nhà cung cấp hoặc chưa đặt lịch chạy */
const STALE_PENDING_MS = 15 * 60 * 1000;

/** Hàng đợi email thông báo: số thư theo trạng thái, thư lỗi gần đây, gửi lại thư lỗi */
export const EmailOutboxCard: React.FC = () => {
  const [summary, setSummary] = useState<EmailOutboxSummary | null>(null);
  const [issues, setIssues] = useState<EmailOutboxRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, rows] = await Promise.all([loadEmailOutboxSummary(), listEmailIssues()]);
      setSummary(s);
      setIssues(rows);
    } catch {
      setNotice({ tone: 'danger', text: 'Không tải được hàng đợi email.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const retry = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const count = await retryFailedEmails();
      setNotice({ tone: 'success', text: count > 0 ? `Đã xếp lại ${count} thư để gửi.` : 'Không có thư lỗi.' });
      await reload();
    } catch {
      setNotice({ tone: 'danger', text: 'Không gửi lại được.' });
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<DataTableColumn<EmailOutboxRow>[]>(
    () => [
      { key: 'created_at', header: 'Thời gian', nowrap: true, render: (row) => formatDateTime(row.created_at) },
      { key: 'to_email', header: 'Người nhận', nowrap: true, render: (row) => row.to_email },
      { key: 'subject', header: 'Tiêu đề', render: (row) => <div className="email-outbox-text">{row.subject}</div> },
      {
        key: 'status',
        header: 'Trạng thái',
        nowrap: true,
        render: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{EMAIL_STATUS_LABEL[row.status]}</Badge>,
      },
      { key: 'last_error', header: 'Lỗi', render: (row) => <div className="email-outbox-text">{row.last_error ?? '—'}</div> },
    ],
    [],
  );

  const failed = summary?.counts.failed ?? 0;
  const stalePending =
    summary?.oldest_pending_at !== null &&
    summary?.oldest_pending_at !== undefined &&
    Date.now() - new Date(summary.oldest_pending_at).getTime() > STALE_PENDING_MS;

  return (
    <Card
      className="email-outbox-card"
      title="Email thông báo"
      action={
        <div className="admin-row-actions">
          <Button type="button" size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} disabled={isLoading} onClick={() => void reload()}>
            Tải lại
          </Button>
          <Button type="button" size="sm" variant="outline" leftIcon={<RotateCcw size={14} />} isLoading={busy} disabled={failed === 0} onClick={() => void retry()}>
            Gửi lại thư lỗi
          </Button>
        </div>
      }
    >
      <div className="admin-stack">
        {notice && <Alert variant={notice.tone}>{notice.text}</Alert>}
        {stalePending && (
          <Alert variant="warning">
            Có thư chờ từ {formatDateTime(summary?.oldest_pending_at ?? '')} chưa được gửi. Kiểm tra khóa nhà cung cấp email và lịch chạy hàm gửi thư.
          </Alert>
        )}
        <div className="admin-summary email-outbox-summary">
          {SUMMARY_ORDER.map((status) => (
            <div key={status} className="admin-summary-item">
              <span className="admin-summary-label">{EMAIL_STATUS_LABEL[status]}</span>
              <span className="admin-summary-value">{summary?.counts[status] ?? 0}</span>
            </div>
          ))}
          <div className="admin-summary-item">
            <span className="admin-summary-label">Gửi gần nhất</span>
            <span className="email-outbox-last">{summary?.last_sent_at ? formatDateTime(summary.last_sent_at) : 'Chưa có'}</span>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={issues}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyText="Không có thư lỗi hoặc đang chờ"
          caption="Thư cần chú ý"
        />
      </div>
    </Card>
  );
};
