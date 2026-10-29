import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PageSkeleton } from '../../../components/layout/PageSkeleton';
import { Alert } from '../../../components/common';
import { getLatestCompletedSession } from '../../assessment_session/assessmentSession.service';
import { AssessmentStartPanel } from '../../assessment_session/components/AssessmentStartPanel';
import { useAuth } from '../../auth/AuthContext';
import { describeGuestError, ensureGuestSession } from '../../auth/guestAccount.service';

/** Khách làm bài test không cần đăng nhập: có tài khoản ẩn danh để lưu bài, làm xong thì khai báo thông tin và tạo tài khoản */
export const GuestTestPage: React.FC = () => {
  const { session, isGuest, isLoading } = useAuth();
  const userId = session?.user.id;
  const [startError, setStartError] = useState<string | null>(null);
  /* null: chưa biết; true: khách này đã làm xong một bài mà chưa tạo tài khoản */
  const [hasFinished, setHasFinished] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading || session) return;
    let active = true;
    ensureGuestSession().catch((error) => {
      if (active) setStartError(describeGuestError(error));
    });
    return () => {
      active = false;
    };
  }, [isLoading, session]);

  useEffect(() => {
    if (!userId || !isGuest) return;
    let active = true;
    getLatestCompletedSession(userId)
      .then((completed) => {
        if (active) setHasFinished(Boolean(completed));
      })
      .catch(() => {
        if (active) setHasFinished(false);
      });
    return () => {
      active = false;
    };
  }, [userId, isGuest]);

  if (startError) {
    return (
      <>
        <h1 className="page-title">Làm bài test</h1>
        <Alert variant="danger">{startError}</Alert>
      </>
    );
  }

  if (isLoading) return <PageSkeleton />;
  if (session && !isGuest) return <Navigate to="/danh-gia-ca-nhan" replace />;
  if (!session || hasFinished === null) return <PageSkeleton />;
  if (hasFinished) return <Navigate to="/hoan-tat-ho-so" replace />;

  return (
    <>
      <h1 className="page-title">Làm bài test</h1>
      <AssessmentStartPanel showTitle={false} />
    </>
  );
};
