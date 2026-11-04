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
  formatPercent,
  nextSurveyStep,
} from '../careerFit.constants';
import { FitBars } from './FitBars';
import { FitRing } from './FitRing';
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
      .catch(() => active && setError('Không tính được nghề phù hợp.'));
    return () => {
      active = false;
    };
  }, [session?.user.id, subjectUserId]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (data === null) return <Skeleton shape="block" />;
  if (!data.hasResult || !data.hasScores) {
    return (
      <div className="fit-empty">
        <Sparkles size={28} aria-hidden="true" />
        <h2>Chưa có kết quả đánh giá</h2>
        {!readOnly && <Button onClick={() => navigate('/danh-gia-ca-nhan')}>Làm bài đánh giá</Button>}
      </div>
    );
  }

  const next = readOnly ? null : nextSurveyStep(data);
  const completeness = Math.round(data.learnerCompleteness * 100);
  const extraTargets = data.targets.filter((target) => !target.inTop);
  const statusBadge = data.statusLabel && (
    <Badge variant={data.statusLabel === 'final_360' ? 'success' : 'info'}>{RESULT_STATUS_LABEL[data.statusLabel] ?? data.statusLabel}</Badge>
  );
  const compareButton = (id: string, size?: 'sm') =>
    onToggleCompare && !readOnly ? (
      <Button size={size} variant={picked.includes(id) ? 'primary' : 'outline'} leftIcon={<GitCompare size={size ? 14 : 16} />} onClick={() => onToggleCompare(id)}>
        {picked.includes(id) ? 'Bỏ so sánh' : 'So sánh'}
      </Button>
    ) : null;

  const [top, ...rest] = data.items;
  return (
    <div className="fit-section">
      <div className="fit-status">
        {statusBadge}
        <span className="fit-completeness">
          <span>Độ đầy đủ dữ liệu {completeness}%</span>
          <span className="fit-bar-track"><span className="fit-bar-fill" style={{ width: `${completeness}%` }} /></span>
        </span>
        {next && <Link className="fit-next" to={next.to}>{next.label}</Link>}
      </div>
      {data.statusLabel === 'self_assessment' && <Alert variant="warning">{PRELIMINARY_NOTE}</Alert>}

      {!top ? (
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
          <article className="fit-hero">
            <FitRing percent={top.fitPercent} size={132} />
            <div className="fit-hero-body">
              <span className="fit-eyebrow">{top.nearThreshold ? 'Gần phù hợp nhất' : 'Phù hợp nhất'}</span>
              <h2>{top.careerName}</h2>
              <div className="career-chips">
                {top.nearThreshold && <Badge variant="warning">Nghề gần đạt</Badge>}
                {top.isTarget && <Badge variant="success">Mục tiêu</Badge>}
              </div>
              <FitBars result={top.result} />
              <div className="fit-actions">
                <Button onClick={() => navigate(careerHref(top.careerId))} rightIcon={<ArrowRight size={16} />}>Xem chi tiết</Button>
                {compareButton(top.careerId)}
              </div>
            </div>
          </article>

          {rest.length > 0 && (
            <ul className="fit-grid">
              {rest.map((item) => (
                <li key={item.careerId} className="fit-card">
                  <span className="fit-card-rank">{item.rank}</span>
                  <FitRing percent={item.fitPercent} size={64} />
                  <div className="fit-card-body">
                    <Link to={careerHref(item.careerId)} className="fit-card-title">{item.careerName}</Link>
                    <div className="career-chips">
                      {item.nearThreshold && <Badge variant="warning" size="sm">Nghề gần đạt</Badge>}
                      {item.isTarget && <Badge variant="success" size="sm">Mục tiêu</Badge>}
                    </div>
                    <FitBars result={item.result} />
                  </div>
                  {compareButton(item.careerId, 'sm')}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {extraTargets.length > 0 && (
        <section className="fit-targets">
          <h3><Target size={16} aria-hidden="true" /> Nghề mục tiêu</h3>
          <ul className="fit-grid">
            {extraTargets.map((item) => (
              <li key={item.careerId} className="fit-card">
                {item.fitPercent === null ? <span className="fit-card-missing">{formatPercent(null)}</span> : <FitRing percent={item.fitPercent} size={64} />}
                <div className="fit-card-body">
                  <Link to={careerHref(item.careerId)} className="fit-card-title">{item.careerName}</Link>
                  {item.nearThreshold && <Badge variant="warning" size="sm">Nghề gần đạt</Badge>}
                  {item.fitPercent !== null && <FitBars result={item.result} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="explain-note">{FIT_DISCLAIMER}</p>
    </div>
  );
};
