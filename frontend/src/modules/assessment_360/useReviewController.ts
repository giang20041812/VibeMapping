import { useCallback, useEffect, useMemo, useState } from 'react';
import { decideSubmission, finalizeResult, getReviewSummary, listSubmissions } from '../submission_review/submission.service';
import type { ReviewSummary, SubmissionRow } from '../submission_review/submission.service';

export type ReviewFilter = 'all' | SubmissionRow['group'];

/** Mọi thứ phần "duyệt bài đã nộp" cần để hiển thị và thao tác; tách khỏi giao diện để xem thử bằng dữ liệu mẫu */
export interface ReviewController {
  rows: SubmissionRow[];
  visible: SubmissionRow[];
  summary: ReviewSummary | null;
  counts: Record<string, number>;
  filter: ReviewFilter;
  isLoading: boolean;
  hasError: boolean;
  busyId: string | null;
  actionError: string | null;
  confirmFinalize: boolean;
  isFinalizing: boolean;
  finalized: boolean;
  setFilter: (filter: ReviewFilter) => void;
  setConfirmFinalize: (open: boolean) => void;
  decide: (row: SubmissionRow, decision: 'accepted' | 'rejected') => void;
  finalize: () => void;
}

export function useReviewController(userId: string | undefined, onFinalized: () => void): ReviewController {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const list = await listSubmissions(userId);
      setRows(list);
      setSummary(await getReviewSummary(userId, list));
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const row of rows) map[row.group] = (map[row.group] ?? 0) + 1;
    return map;
  }, [rows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.group === filter);

  return {
    rows,
    visible,
    summary,
    counts,
    filter,
    isLoading,
    hasError,
    busyId,
    actionError,
    confirmFinalize,
    isFinalizing,
    finalized: summary?.finalized ?? false,
    setFilter,
    setConfirmFinalize,
    decide: async (row, decision) => {
      setBusyId(row.id);
      setActionError(null);
      try {
        await decideSubmission(row.id, decision);
        await reload();
      } catch {
        setActionError('Không lưu được quyết định, vui lòng thử lại');
      } finally {
        setBusyId(null);
      }
    },
    finalize: async () => {
      if (!summary?.resultId) return;
      setIsFinalizing(true);
      setActionError(null);
      try {
        const result = await finalizeResult(summary.resultId);
        if (!result.ok) throw new Error('not_ok');
        onFinalized();
      } catch {
        setConfirmFinalize(false);
        setActionError('Không chốt được kết quả, vui lòng thử lại');
        setIsFinalizing(false);
      }
    },
  };
}
