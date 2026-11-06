import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button, Modal } from '../../../components/common';
import { JoinedClassesSection } from '../../class_management/components/JoinedClassesSection';
import { GLOBE_NODES } from '../assessment360.constants';
import type { InviteController } from '../useInviteController';
import type { ReviewController } from '../useReviewController';
import { InviteLinksSection, InvitePanel, invitesEnabled } from './InvitePanel';
import { ReviewPanel } from './ReviewPanel';
import './Assessment360.css';

export interface Assessment360ViewProps {
  invite: InviteController;
  review: ReviewController;
  /** Học sinh, sinh viên đang xem; có thì hộp thoại có thêm phần lớp học */
  userId?: string;
}

/**
 * Công tắc đánh giá 360 có quả địa cầu và nút "Ai đánh giá" luôn có cho học sinh, sinh viên:
 * hộp thoại gồm đường dẫn mời, bài đã nộp và lớp học (giáo viên của lớp là một người đánh giá).
 * Mở sẵn khi vào bằng mã lớp (?ma=).
 */
export const Assessment360View: React.FC<Assessment360ViewProps> = ({ invite, review, userId }) => {
  const [searchParams] = useSearchParams();
  const classCode = searchParams.get('ma') ?? '';
  const [setupOpen, setSetupOpen] = useState(classCode !== '');
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const enabled = invitesEnabled(invite);
  const hasResult = invite.state?.resultId != null;
  const showReview = hasResult && (enabled || review.rows.length > 0);
  const showSetup = showReview || userId !== undefined;
  const pending = review.rows.filter((r) => r.status === 'pending').length;
  // Hộp thoại con đang mở thì Esc chỉ đóng hộp thoại con
  const childOpen = invite.revokeTarget !== null || invite.confirmOff || review.confirmFinalize || classDialogOpen;

  const action = showSetup ? (
    <Button variant="cartoon" size="lg" className="t360-who" onClick={() => setSetupOpen(true)} leftIcon={<Users size={20} />}>
      Ai đánh giá?
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
          {showReview && <ReviewPanel controller={review} />}
          {userId !== undefined && <JoinedClassesSection userId={userId} initialClassCode={classCode} onDialogOpenChange={setClassDialogOpen} />}
        </div>
      </Modal>
    </div>
  );
};
