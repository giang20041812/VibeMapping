import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getInProgressSession } from '../../assessment_session/assessmentSession.service';
import { Alert, Button, Modal } from '../../../components/common';
import { EMPTY_RESULT } from '../../assessment_result/assessmentResult.constants';
import { getLatestAssessmentResult } from '../../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../../assessment_result/assessmentResult.types';
import { ResultSkeleton } from '../../assessment_result/components/ResultSkeleton';
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
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [inProgressId, setInProgressId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId || !learner) return;
    let active = true;
    setIsLoading(true);
    setHasError(false);
    Promise.all([getLatestAssessmentResult(userId), getInProgressSession(userId).catch(() => null)])
      .then(([value, current]) => {
        if (!active) return;
        setResult(value);
        setInProgressId(current?.id ?? null);
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
    <section className="personal-section" aria-label="Kết quả">

      {isLoading && <ResultSkeleton />}
      {!isLoading && hasError && <Alert variant="danger">Không tải được kết quả đánh giá</Alert>}
      {!isLoading && !hasError && !result && (
        <ResultView
          result={EMPTY_RESULT}
          cover={
            <Button
              size="lg"
              onClick={() => (inProgressId ? navigate(`/danh-gia-ca-nhan/${inProgressId}`) : setRetakeOpen(true))}
              rightIcon={<ArrowRight size={18} />}
            >
              {inProgressId ? 'Tiếp tục bài đang làm dở' : 'Làm bài đánh giá'}
            </Button>
          }
        />
      )}
      {!isLoading && !hasError && result && <ResultView
          result={result}
          onRetake={() => setRetakeOpen(true)}
          onContinue={inProgressId ? () => navigate(`/danh-gia-ca-nhan/${inProgressId}`) : undefined}
        />}
    </section>
  );

  return (
    <>
      <h1 className="page-title">Đánh giá cá nhân</h1>
      <div className="personal-layout">
        {resultSection}
        <Modal wide open={retakeOpen} title="Làm bài đánh giá" onClose={() => setRetakeOpen(false)}>
          <AssessmentStartPanel showDisclaimer={!result} showTitle={false} />
        </Modal>
      </div>
    </>
  );
};
