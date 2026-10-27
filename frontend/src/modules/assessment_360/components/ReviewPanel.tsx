import React from 'react';
import { Check, Flag, RotateCcw, X } from 'lucide-react';
import { Alert, Badge, Button, Card, Modal } from '../../../components/common';
import { GROUP_LABEL, INVITE_GROUPS } from '../../invitation_link/invitation.constants';
import { QUALITY_TEXT, TRUST_LABEL_TEXT, understandingLabel } from '../../submission_review/submission.service';
import type { SubmissionRow, SubmissionStatus } from '../../submission_review/submission.service';
import type { ReviewController } from '../useReviewController';
import { ReviewSkeleton } from './Assessment360Skeleton';

const STATUS_TEXT: Record<SubmissionStatus, string> = {
  pending: 'Chờ duyệt',
  accepted: 'Đã chấp nhận',
  rejected: 'Đã loại bỏ',
};
const STATUS_VARIANT: Record<SubmissionStatus, 'info' | 'success' | 'default'> = {
  pending: 'info',
  accepted: 'success',
  rejected: 'default',
};
const TRUST_VARIANT = { trusted: 'success', consider: 'warning', suggest_reject: 'danger' } as const;

const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

const ReviewRow: React.FC<{ row: SubmissionRow; busy: boolean; finalized: boolean; onDecide: ReviewController['decide'] }> = ({
  row,
  busy,
  finalized,
  onDecide,
}) => (
  <li className={`review-row status-${row.status}`}>
    <div className="review-who">
      <span className="review-avatar" aria-hidden="true">
        {(row.nickname || 'Ẩ').trim().charAt(0).toUpperCase()}
      </span>
      <div className="review-who-text">
        <span className="review-name">{row.nickname?.trim() ? row.nickname : 'Ẩn danh'}</span>
        <span className="review-meta">
          {GROUP_LABEL[row.group]}
          {row.relationship ? ` · ${row.relationship}` : ''}
        </span>
        <span className="review-time">{formatTime(row.submittedAt)}</span>
      </div>
    </div>

    <div className="review-quality">
      {row.understandingScore !== null && <span className="review-level">{understandingLabel(row.understandingScore)}</span>}
      <div className="review-badges">
        {row.trustLabel && <Badge variant={TRUST_VARIANT[row.trustLabel]}>{TRUST_LABEL_TEXT[row.trustLabel]}</Badge>}
        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_TEXT[row.status]}</Badge>
      </div>
      {row.qualityFlag !== 'ok' && QUALITY_TEXT[row.qualityFlag] && <span className="review-flag">{QUALITY_TEXT[row.qualityFlag]}</span>}
    </div>

    {!finalized && (
      <div className="review-actions">
        {row.status === 'pending' ? (
          <>
            <Button size="sm" isLoading={busy} onClick={() => onDecide(row, 'accepted')} leftIcon={<Check size={16} />}>
              Chấp nhận
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(row, 'rejected')} leftIcon={<X size={16} />}>
              Loại bỏ
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            isLoading={busy}
            onClick={() => onDecide(row, row.status === 'accepted' ? 'rejected' : 'accepted')}
            leftIcon={<RotateCcw size={16} />}
          >
            Đổi lại quyết định
          </Button>
        )}
      </div>
    )}
  </li>
);

/** Danh sách bài đã nộp, duyệt từng bài và chốt kết quả */
export const ReviewPanel: React.FC<{ controller: ReviewController }> = ({ controller }) => {
  const { summary, rows, visible, counts, filter, finalized } = controller;

  return (
    <section className="t360-review" aria-labelledby="t360-review-title">
      <h2 id="t360-review-title" className="section-title">
        Bài đã nộp
      </h2>

      {controller.isLoading && <ReviewSkeleton />}
      {!controller.isLoading && controller.hasError && <Alert variant="danger">Không tải được danh sách bài đã nộp</Alert>}

      {!controller.isLoading && !controller.hasError && summary && (
        <>
          <Card className="review-summary">
            <div className="review-summary-body">
              <div className="review-progress">
                {summary.progress.length === 0 ? (
                  <span className="review-progress-empty">Chưa có đường dẫn mời đang mở.</span>
                ) : (
                  summary.progress.map((p) => (
                    <span key={p.group} className="review-progress-chip">
                      <span className="review-progress-name">{GROUP_LABEL[p.group]}</span>
                      <strong>
                        {p.accepted}/{p.expected}
                      </strong>
                    </span>
                  ))
                )}
              </div>
              {!finalized && (
                <Button size="lg" onClick={() => controller.setConfirmFinalize(true)} disabled={summary.acceptedCount < 1} leftIcon={<Flag size={18} />}>
                  Chốt kết quả
                </Button>
              )}
            </div>
          </Card>

          {finalized && (
            <Alert variant="success" title="Kết quả đã được chốt">
              Các quyết định không còn thay đổi được.
            </Alert>
          )}
          {controller.actionError && <Alert variant="danger">{controller.actionError}</Alert>}

          {rows.length === 0 ? (
            <Alert variant="info">Chưa có bài đánh giá nào được nộp.</Alert>
          ) : (
            <>
              <div className="review-tabs" role="tablist" aria-label="Lọc theo nhóm">
                {[{ key: 'all' as const, label: 'Tất cả' }, ...INVITE_GROUPS.filter((g) => counts[g.key])].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={filter === tab.key}
                    className={`review-tab ${filter === tab.key ? 'is-active' : ''}`}
                    onClick={() => controller.setFilter(tab.key)}
                  >
                    {tab.label}
                    <span className="review-tab-count">{counts[tab.key] ?? 0}</span>
                  </button>
                ))}
              </div>

              <ul className="review-list">
                {visible.map((row) => (
                  <ReviewRow key={row.id} row={row} busy={controller.busyId === row.id} finalized={finalized} onDecide={controller.decide} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Modal
        open={controller.confirmFinalize}
        title="Chốt kết quả"
        onClose={() => controller.setConfirmFinalize(false)}
        locked={controller.isFinalizing}
        actions={
          <>
            <Button variant="outline" onClick={() => controller.setConfirmFinalize(false)} disabled={controller.isFinalizing}>
              Hủy
            </Button>
            <Button onClick={controller.finalize} isLoading={controller.isFinalizing}>
              Chốt kết quả
            </Button>
          </>
        }
      >
        {summary?.acceptedCount === 1 && (
          <Alert variant="warning" title="Dữ liệu mỏng">
            Chỉ có 1 bài được chấp nhận. Kết quả sẽ được gắn cờ Dữ liệu mỏng.
          </Alert>
        )}
        <p>Sau khi chốt, kết quả được khóa vào hồ sơ và người chưa nộp bài bị loại khỏi tính toán.</p>
      </Modal>
    </section>
  );
};
