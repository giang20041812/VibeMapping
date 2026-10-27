import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { isInviteLocked, isLearnerRole } from '../../profile/profile.logic';
import { Assessment360View } from '../components/Assessment360View';
import { useInviteController } from '../useInviteController';
import { useReviewController } from '../useReviewController';

/** Mời người khác đánh giá và duyệt bài đã nộp, trên cùng một trang */
export const Assessment360Page: React.FC = () => {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const learner = isLearnerRole(profile?.role);
  const userId = learner ? session?.user.id : undefined;

  const invite = useInviteController(userId, isInviteLocked(profile));
  const review = useReviewController(userId, () => navigate('/danh-gia-ca-nhan', { replace: true }));

  return (
    <>
      <h1 className="page-title">Đánh giá 360</h1>
      {learner ? (
        <Assessment360View invite={invite} review={review} />
      ) : (
        <Alert variant="info">Chức năng đánh giá 360 dành cho học sinh và sinh viên.</Alert>
      )}
    </>
  );
};
