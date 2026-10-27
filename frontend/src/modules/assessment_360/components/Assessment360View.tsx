import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button, Modal, Tabs } from '../../../components/common';
import { JoinedClassesSection } from '../../class_management/components/JoinedClassesSection';
import { GLOBE_NODES } from '../assessment360.constants';
import type { TabItem } from '../../../components/common';
import type { InviteController } from '../useInviteController';
import type { ReviewController } from '../useReviewController';
import { InviteLinksSection, InvitePanel, invitesEnabled } from './InvitePanel';
import { ReviewPanel } from './ReviewPanel';
import './Assessment360.css';

type SetupTab = 'invite' | 'class';

export interface Assessment360ViewProps {
  invite: InviteController;
  review: ReviewController;
  /** Học sinh, sinh viên đang xem; có thì hộp thoại có thêm phần lớp học */
  userId?: string;
}

/**
 * Công tắc đánh giá 360 có quả địa cầu và nút "Ai đánh giá" luôn có cho học sinh, sinh viên:
 * hộp thoại có hai tab: mời đánh giá (đường dẫn mời, bài đã nộp) và lớp học (giáo viên của lớp là một người đánh giá).
 * Mở sẵn khi vào bằng mã lớp (?ma=).
 */
export const Assessment360View: React.FC<Assessment360ViewProps> = ({ invite, review, userId }) => {
  const [searchParams] = useSearchParams();
  const classCode = searchParams.get('ma') ?? '';
  const [setupOpen, setSetupOpen] = useState(classCode !== '');
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [tab, setTab] = useState<SetupTab>(classCode !== '' ? 'class' : 'invite');
  const enabled = invitesEnabled(invite);
  const hasResult = invite.state?.resultId != null;
  const showReview = hasResult && (enabled || review.rows.length > 0);
  const showSetup = showReview || userId !== undefined;
  const pending = review.rows.filter((r) => r.status === 'pending').length;
  // Hộp thoại con đang mở thì Esc chỉ đóng hộp thoại con
  const childOpen = invite.revokeTarget !== null || invite.confirmOff || review.confirmFinalize || classDialogOpen;

  const tabs: TabItem[] = [];
  if (showReview) tabs.push({ value: 'invite', label: 'Mời đánh giá', alert: pending > 0 });
  if (userId !== undefined) tabs.push({ value: 'class', label: 'Lớp học' });
  const activeTab = tabs.some((item) => item.value === tab) ? tab : (tabs[0]?.value ?? 'invite');

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
          {tabs.length > 1 && <Tabs items={tabs} value={activeTab} onChange={(value) => setTab(value as SetupTab)} label="Người đánh giá" />}
          {activeTab === 'invite' && showReview && (
            <>
              {enabled && <InviteLinksSection controller={invite} />}
              <ReviewPanel controller={review} />
            </>
          )}
          {activeTab === 'class' && userId !== undefined && (
            <JoinedClassesSection userId={userId} initialClassCode={classCode} onDialogOpenChange={setClassDialogOpen} />
          )}
        </div>
      </Modal>
    </div>
  );
};
