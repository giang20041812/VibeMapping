import React, { useState } from 'react';
import { Assessment360View } from '../components/Assessment360View';
import { emptySelections } from '../useInviteController';
import type { InviteController } from '../useInviteController';
import type { ReviewController } from '../useReviewController';
import type { InviteLink } from '../../invitation_link/invitation.service';
import type { SubmissionRow } from '../../submission_review/submission.service';

const day = 86_400_000;

const LINKS: InviteLink[] = [
  { id: 'l1', group: 'parent', token: 'mau-phu-huynh', expectedCount: 2, expiresAt: new Date(Date.now() + 10 * day).toISOString(), expired: false, submittedCount: 1, acceptedCount: 1 },
  { id: 'l2', group: 'friend', token: 'mau-ban-be', expectedCount: 5, expiresAt: new Date(Date.now() + 6 * day).toISOString(), expired: false, submittedCount: 2, acceptedCount: 0 },
];

const ROWS: SubmissionRow[] = [
  { id: 's1', group: 'parent', nickname: 'Mẹ', relationship: 'Phụ huynh', understandingScore: 11, trustLabel: 'trusted', trustIndex: 0.84, qualityFlag: 'ok', submittedAt: new Date().toISOString(), status: 'accepted' },
  { id: 's2', group: 'friend', nickname: 'Minh', relationship: 'Bạn thân', understandingScore: 8, trustLabel: 'consider', trustIndex: 0.55, qualityFlag: 'ok', submittedAt: new Date().toISOString(), status: 'pending' },
  { id: 's3', group: 'friend', nickname: null, relationship: 'Bạn cùng lớp', understandingScore: 5, trustLabel: 'suggest_reject', trustIndex: 0.2, qualityFlag: 'ok', submittedAt: new Date().toISOString(), status: 'pending' },
];

const noop = () => undefined;

/** Dữ liệu mẫu để xem giao diện đánh giá 360 khi chưa có dữ liệu thật. Chỉ có trong môi trường phát triển. */
export const Assessment360SamplePage: React.FC = () => {
  const [on, setOn] = useState(true);
  const [filter, setFilter] = useState<ReviewController['filter']>('all');

  const invite: InviteController = {
    state: { resultId: 'mau', finalized: false, consent: on ? 'granted' : 'declined', links: on ? LINKS : [], expiryDays: 14 },
    isLoading: false,
    hasError: false,
    busy: false,
    locked: false,
    actionError: null,
    notice: null,
    selections: emptySelections(),
    pickerError: null,
    revokeTarget: null,
    confirmOff: false,
    consentOpen: false,
    setSelection: noop,
    setRevokeTarget: noop,
    setConfirmOff: noop,
    setConsentOpen: noop,
    requestToggle: () => setOn((value) => !value),
    answerConsent: noop,
    createLinks: noop,
    revoke: noop,
    recreate: noop,
    turnOff: noop,
  };

  const visible = filter === 'all' ? ROWS : ROWS.filter((r) => r.group === filter);
  const review: ReviewController = {
    rows: ROWS,
    visible,
    summary: {
      resultId: 'mau',
      finalized: false,
      acceptedCount: 1,
      thinData: true,
      progress: [
        { group: 'parent', expected: 2, accepted: 1 },
        { group: 'friend', expected: 5, accepted: 0 },
      ],
    },
    counts: { all: 3, parent: 1, friend: 2 },
    filter,
    isLoading: false,
    hasError: false,
    busyId: null,
    actionError: null,
    confirmFinalize: false,
    isFinalizing: false,
    finalized: false,
    setFilter,
    setConfirmFinalize: noop,
    decide: noop,
    finalize: noop,
  };

  return (
    <>
      <h1 className="page-title">Đánh giá 360</h1>
      <Assessment360View invite={invite} review={review} />
    </>
  );
};
