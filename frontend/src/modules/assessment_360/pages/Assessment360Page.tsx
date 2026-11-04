import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { isInviteLocked, isLearnerRole } from '../../profile/profile.logic';
import { PersonalResultSection } from '../../personal_assessment/components/PersonalResultSection';
import { Assessment360View } from '../components/Assessment360View';
import { useInviteController } from '../useInviteController';
import { useReviewController } from '../useReviewController';
import './Assessment360Page.css';

/** Công tắc đánh giá 360 ở trên, kết quả tổng thể và làm bài tự đánh giá ở dưới */
export const Assessment360Page: React.FC = () => {
  const { session, profile } = useAuth();
  const learner = isLearnerRole(profile?.role);
  const userId = learner ? session?.user.id : undefined;
  const [resultKey, setResultKey] = useState(0);
  const onFinalized = useCallback(() => setResultKey((k) => k + 1), []);

  const invite = useInviteController(userId, isInviteLocked(profile));
  const review = useReviewController(userId, onFinalized);
  const reloadReview = review.reload;
  const reloadInvite = invite.reload;

  // Tiến độ theo nhóm lấy từ các đường dẫn đang mở: đọc lại mỗi khi đường dẫn được tạo, thu hồi hoặc tắt
  useEffect(() => {
    if (invite.state) void reloadReview();
  }, [invite.state, reloadReview]);

  // Chốt xong thì trạng thái mời cũng đổi (không thêm người đánh giá được nữa)
  useEffect(() => {
    if (resultKey > 0) void reloadInvite();
  }, [resultKey, reloadInvite]);

  return (
    <>
      <h1 className="page-title">Đánh giá 360</h1>
      {learner && userId ? (
        <div className="assessment-page">
          <Assessment360View invite={invite} review={review} />
          <PersonalResultSection userId={userId} reloadKey={resultKey} />
        </div>
      ) : (
        <Alert variant="info">Đánh giá dành cho học sinh và sinh viên.</Alert>
      )}
    </>
  );
};
