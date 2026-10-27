import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Alert, Skeleton } from '../../../components/common';
import { getLatestAssessmentResult } from '../../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../../assessment_result/assessmentResult.types';
import { ResultView } from '../../assessment_result/components/ResultView';
import { AssessmentStartPanel } from '../../assessment_session/components/AssessmentStartPanel';
import { useAuth } from '../../auth/AuthContext';
import { isLearnerRole } from '../../profile/profile.logic';
import '../../assessment_result/components/EmptyResult.css';
import './PersonalAssessmentPage.css';

/** Kết quả tự đánh giá (biểu đồ đa giác, điểm theo nhóm) và làm bài, trên cùng một trang */
export const PersonalAssessmentPage: React.FC = () => {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const learner = isLearnerRole(profile?.role);
  const [result, setResult] = useState<AssessmentResultSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!userId || !learner) return;
    let active = true;
    setIsLoading(true);
    setHasError(false);
    getLatestAssessmentResult(userId)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, learner]);

  if (!learner) {
    return (
      <>
        <h1 className="page-title">Đánh giá cá nhân</h1>
        <Alert variant="info">Bài tự đánh giá dành cho học sinh và sinh viên.</Alert>
      </>
    );
  }

  const resultSection = (
    <section className="personal-section" aria-labelledby="personal-result-title">
      <h2 id="personal-result-title" className="section-title">
        Kết quả
      </h2>
      {isLoading && (
        <div className="result-skeleton">
          <Skeleton className="skeleton-block" />
          <Skeleton className="skeleton-block" />
        </div>
      )}
      {!isLoading && hasError && <Alert variant="danger">Không tải được kết quả đánh giá</Alert>}
      {!isLoading && !hasError && !result && (
        <div className="empty-result">
          <span className="empty-result-badge">
            <BarChart3 size={36} aria-hidden="true" />
          </span>
          <p className="empty-result-title">Chưa có kết quả đánh giá</p>
        </div>
      )}
      {!isLoading && !hasError && result && <ResultView result={result} />}
    </section>
  );

  return (
    <>
      <h1 className="page-title">Đánh giá cá nhân</h1>
      <div className="personal-layout">
        {result ? (
          <>
            {resultSection}
            <AssessmentStartPanel showDisclaimer={false} />
          </>
        ) : (
          <>
            <AssessmentStartPanel />
            {resultSection}
          </>
        )}
      </div>
    </>
  );
};
