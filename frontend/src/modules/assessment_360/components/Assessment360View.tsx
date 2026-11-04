import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { Button, Modal } from '../../../components/common';
import { GLOBE_NODES } from '../assessment360.constants';
import type { InviteController } from '../useInviteController';
import type { ReviewController } from '../useReviewController';
import { InviteLinksSection, InvitePanel, invitesEnabled } from './InvitePanel';
import { ReviewPanel } from './ReviewPanel';
import './Assessment360.css';

export interface Assessment360ViewProps {
  invite: InviteController;
  review: ReviewController;
}

/**
 * Công tắc đánh giá 360 có quả địa cầu; khi bật (hoặc đã có bài nộp) hiện nút "Ai đánh giá"
 * mở hộp thoại thiết lập đường dẫn mời và duyệt bài đã nộp.
 */
export const Assessment360View: React.FC<Assessment360ViewProps> = ({ invite, review }) => {
  const [setupOpen, setSetupOpen] = useState(false);
  const enabled = invitesEnabled(invite);
  const hasResult = invite.state?.resultId != null;
  const showSetup = hasResult && (enabled || review.rows.length > 0);
  const pending = review.rows.filter((r) => r.status === 'pending').length;
  // Hộp thoại con đang mở thì Esc chỉ đóng hộp thoại con
  const childOpen = invite.revokeTarget !== null || invite.confirmOff || review.confirmFinalize;

  const action = showSetup ? (
    <Button variant="cartoon" size="lg" className="t360-who" onClick={() => setSetupOpen(true)} leftIcon={<Users size={20} />}>
      Ai đánh giá
      {pending > 0 && (
        <span className="t360-who-count" aria-label={`${pending} bài chờ duyệt`}>
          {pending}
        </span>
      )}
    </Button>
  ) : undefined;

  return (
    <div className="t360-stack">
      <InvitePanel controller={invite} nodes={GLOBE_NODES} action={action} />
      <Modal wide open={setupOpen && showSetup} title="Người đánh giá" onClose={() => setSetupOpen(false)} locked={childOpen}>
        <div className="t360-setup">
          {enabled && <InviteLinksSection controller={invite} />}
          <ReviewPanel controller={review} />
        </div>
      </Modal>
    </div>
  );
};
