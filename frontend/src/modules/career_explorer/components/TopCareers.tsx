import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, GitCompare, Sparkles, Target } from 'lucide-react';
import { Alert, Badge, Button, Skeleton } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { recommendCareers, type CareerRecommendations } from '../career.service';
import {
  FIT_DISCLAIMER,
  NEAR_FIT_NOTE,
  PRELIMINARY_NOTE,
  RESULT_STATUS_LABEL,
  nextSurveyStep,
} from '../careerFit.constants';
import { FitListHead, FitMeter, FitRow } from './FitRow';
import '../pages/CareerFit.css';

interface Props {
  picked?: string[];
  onToggleCompare?: (id: string) => void;
  onBrowse?: () => void;
  /** Phụ huynh xem nghề phù hợp của con đã chia sẻ kết quả: chỉ đọc */
  subjectUserId?: string;
}

/** Nghề phù hợp nhất và các nghề tiếp theo (R20), nghề mục tiêu ngoài danh sách vẫn hiện */
export const TopCareers: React.FC<Props> = ({ picked = [], onToggleCompare, onBrowse, subjectUserId }) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<CareerRecommendations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = Boolean(subjectUserId);
  const careerHref = (id: string) => (subjectUserId ? `/nghe/${id}?con=${subjectUserId}` : `/nghe/${id}`);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;
    recommendCareers(subjectUserId)
      .then((value) => active && setData(value))
      .catch(() => active && setError('Chưa tính được nghề'));
    return () => {
      active = false;
    };
  }, [session?.user.id, subjectUserId]);

  if (error) return <div className="fit-error"><Alert variant="danger">{error}</Alert></div>;
  if (data === null) return <Skeleton shape="block" />;
  if (!data.hasResult || !data.hasScores) {
    return (
      <div className="fit-empty">
        <Sparkles size={28} aria-hidden="true" />
        <h2>Chưa có kết quả đánh giá</h2>
        {!readOnly && <Button onClick={() => navigate('/danh-gia-360')}>Làm bài đánh giá</Button>}
      </div>
    );
  }

  const next = readOnly ? null : nextSurveyStep(data);
  const completeness = Math.round(data.learnerCompleteness * 100);
  const extraTargets = data.targets.filter((target) => !target.inTop);
  const statusBadge = data.statusLabel && (
    <Badge variant={data.statusLabel === 'final_360' ? 'success' : 'info'}>{RESULT_STATUS_LABEL[data.statusLabel] ?? data.statusLabel}</Badge>
  );
  const compareButton = (id: string) =>
    onToggleCompare && !readOnly ? (
      <Button size="sm" variant={picked.includes(id) ? 'primary' : 'outline'} leftIcon={<GitCompare size={14} />} onClick={() => onToggleCompare(id)}>
        {picked.includes(id) ? 'Bỏ so sánh' : 'So sánh'}
      </Button>
    ) : null;

  return (
    <div className="fit-section">
      <div className="fit-status">
        {statusBadge}
        <span className="fit-completeness">
          <span>Độ đầy đủ dữ liệu <b>{completeness}%</b></span>
          <FitMeter percent={completeness} />
        </span>
        {next && <Link className="fit-next" to={next.to}>{next.label} <ArrowRight size={15} aria-hidden="true" /></Link>}
      </div>
      {data.statusLabel === 'self_assessment' && <Alert variant="warning">{PRELIMINARY_NOTE}</Alert>}

      {data.items.length === 0 ? (
        <div className="fit-empty">
          <Sparkles size={28} aria-hidden="true" />
          <h2>Chưa tìm thấy nghề đạt ngưỡng phù hợp</h2>
          {!readOnly && (
            <div className="fit-empty-actions">
              {next && <Button onClick={() => navigate(next.to)}>{next.label}</Button>}
              <Button variant="outline" onClick={onBrowse ?? (() => navigate('/nghe'))}>Xem danh mục nghề</Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {data.belowThreshold && <Alert variant="warning">{NEAR_FIT_NOTE}</Alert>}
          <div className="fit-list">
            <FitListHead />
            <ol className="fit-rows" aria-label="Các nghề phù hợp">
              {data.items.map((item, index) => (
                <FitRow
                  key={item.careerId}
                  item={item}
                  href={careerHref(item.careerId)}
                  isTop={index === 0}
                  compare={compareButton(item.careerId)}
                />
              ))}
            </ol>
          </div>
        </>
      )}

      {extraTargets.length > 0 && (
        <section className="fit-targets">
          <h3><Target size={16} aria-hidden="true" /> Nghề mục tiêu</h3>
          <div className="fit-list">
            <FitListHead />
            <ol className="fit-rows">
              {extraTargets.map((item) => (
                <FitRow
                  key={item.careerId}
                  item={{ ...item, isTarget: true }}
                  href={careerHref(item.careerId)}
                  compare={compareButton(item.careerId)}
                />
              ))}
            </ol>
          </div>
        </section>
      )}

      <p className="explain-note">{FIT_DISCLAIMER}</p>
    </div>
  );
};
