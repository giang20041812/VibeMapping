import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { getInProgressSession } from '../../assessment_session/assessmentSession.service';
import { Alert, Button, Modal } from '../../../components/common';
import { EMPTY_RESULT } from '../../assessment_result/assessmentResult.constants';
import { getLatestAssessmentResult } from '../../assessment_result/assessmentResult.service';
import type { AssessmentResultSummary } from '../../assessment_result/assessmentResult.types';
import { ResultSkeleton } from '../../assessment_result/components/ResultSkeleton';
import { ResultView } from '../../assessment_result/components/ResultView';
import { ResultInsightsPanel } from '../../assessment_result/components/ResultInsightsPanel';
import { AssessmentStartPanel } from '../../assessment_session/components/AssessmentStartPanel';
import '../../assessment_result/components/EmptyResult.css';
import './PersonalResultSection.css';

export interface PersonalResultSectionProps {
  userId: string;
  /** Tăng lên để đọc lại kết quả, ví dụ sau khi chốt kết quả 360 */
  reloadKey?: number;
}

/** Kết quả tổng thể (biểu đồ đa giác, điểm theo nhóm), làm bài đánh giá và gợi ý nghề khi đã có kết quả */
export const PersonalResultSection: React.FC<PersonalResultSectionProps> = ({ userId, reloadKey = 0 }) => {
  const [result, setResult] = useState<AssessmentResultSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [inProgressId, setInProgressId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
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
  }, [userId, reloadKey]);

  const continuePath = inProgressId ? `/danh-gia-ca-nhan/${inProgressId}` : null;

  return (
    <section className="personal-section" aria-label="Kết quả tổng thể">
      <h2 className="section-title">Kết quả tổng thể</h2>
      {isLoading && <ResultSkeleton />}
      {!isLoading && hasError && <Alert variant="danger">Không tải được kết quả đánh giá</Alert>}
      {!isLoading && !hasError && !result && (
        <ResultView
          result={EMPTY_RESULT}
          cover={
            <Button
              size="lg"
              onClick={() => (continuePath ? navigate(continuePath) : setRetakeOpen(true))}
              rightIcon={<ArrowRight size={18} />}
            >
              {continuePath ? 'Tiếp tục bài đang làm dở' : 'Làm bài đánh giá'}
            </Button>
          }
        />
      )}
      {!isLoading && !hasError && result && (
        <>
          <ResultView
            result={result}
            onRetake={() => setRetakeOpen(true)}
            onContinue={continuePath ? () => navigate(continuePath) : undefined}
          />
          <div className="personal-career-cta">
            <Button variant="cartoon" size="lg" onClick={() => navigate('/nghe')} leftIcon={<Compass size={20} />} rightIcon={<ArrowRight size={18} />}>
              Gợi ý nghề nghiệp phù hợp
            </Button>
          </div>
          <ResultInsightsPanel userId={userId} isOwner />
        </>
      )}
      <Modal wide open={retakeOpen} title="Làm bài đánh giá" onClose={() => setRetakeOpen(false)}>
        <AssessmentStartPanel showDisclaimer={!result} showTitle={false} />
      </Modal>
    </section>
  );
};
