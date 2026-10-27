import React from 'react';
import { GLOBE_NODES } from '../assessment360.constants';
import type { InviteController } from '../useInviteController';
import type { ReviewController } from '../useReviewController';
import { InvitePanel } from './InvitePanel';
import { ReviewPanel } from './ReviewPanel';
import './Assessment360.css';

export interface Assessment360ViewProps {
  invite: InviteController;
  review: ReviewController;
}

/**
 * Trang đánh giá 360: công tắc quả địa cầu ở trên cùng, bên dưới là đường dẫn mời (khi đang bật)
 * và bài đã nộp, cùng phủ hết chiều ngang.
 */
export const Assessment360View: React.FC<Assessment360ViewProps> = ({ invite, review }) => {
  const state = invite.state;
  const hasResult = state?.resultId != null;
  const invitesVisible = hasResult && !invite.locked && !state.finalized && state.consent === 'granted';

  return (
    <div className={`t360-grid ${invitesVisible ? '' : 'is-single'}`}>
      <InvitePanel controller={invite} nodes={GLOBE_NODES} />
      {hasResult && <ReviewPanel controller={review} />}
    </div>
  );
};
