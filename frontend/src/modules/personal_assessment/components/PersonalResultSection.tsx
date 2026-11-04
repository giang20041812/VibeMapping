import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { getInProgressSession } from '../../assessment_session/assessmentSession.service';
import { Alert, Button, Modal } from '../../../components/common';
import { EMPTY_RESULT } from '../../assessment_result/assessmentResult.constants';
import { getAssessmentResult, listAssessmentResults, type AssessmentResultListItem } from '../../assessment_result/assessmentResult.service';
import { loadResultInsights, type ResultInsights } from '../../assessment_result/resultInsights.service';
import { ResultProfileFooter, ResultProfileHeader } from '../../assessment_result/components/ResultProfile';
import { TopCareers } from '../../career_explorer/components/TopCareers';
import type { AssessmentResultSummary } from '../../assessment_result/assessmentResult.types';
import { ResultSkeleton } from '../../assessment_result/components/ResultSkeleton';
import { ResultView } from '../../assessment_result/components/ResultView';
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
  const [history, setHistory] = useState<AssessmentResultListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [insights, setInsights] = useState<ResultInsights | null>(null);
  const navigate = useNavigate();

  // Danh sách các lần có kết quả; mỗi lần làm mới (hoặc chốt 360) chọn lại lần mới nhất
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setHasError(false);
    Promise.all([listAssessmentResults(userId), getInProgressSession(userId).catch(() => null)])
      .then(([list, current]) => {
        if (!active) return;
        setHistory(list);
        setSelectedId(list[0]?.id ?? null);
        setInProgressId(current?.id ?? null);
        if (list.length === 0) {
          setResult(null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  // Điểm và hồ sơ của lần đang chọn
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setInsights(null);
    Promise.all([getAssessmentResult(userId, selectedId), loadResultInsights(userId, true, selectedId).catch(() => null)])
      .then(([value, detail]) => {
        if (!active) return;
        setResult(value);
        setInsights(detail);
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
  }, [userId, selectedId, reloadKey]);

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
            header={<ResultProfileHeader insights={insights} history={history} selectedId={selectedId} onSelect={setSelectedId} />}
            footer={<ResultProfileFooter insights={insights} />}
          />
          <div className="personal-career-cta">
            <Button variant="cartoon" size="lg" onClick={() => navigate('/nghe')} leftIcon={<Compass size={20} />} rightIcon={<ArrowRight size={18} />}>
              Gợi ý nghề nghiệp phù hợp
            </Button>
          </div>
          <TopCareers />
        </>
      )}
      <Modal wide open={retakeOpen} title="Làm bài đánh giá" onClose={() => setRetakeOpen(false)}>
        <AssessmentStartPanel showDisclaimer={!result} showTitle={false} />
      </Modal>
    </section>
  );
};
