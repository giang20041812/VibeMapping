import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, GitCompare, Sparkles, Target, Trophy } from 'lucide-react';
import { Alert, Badge, Button, Skeleton, stickerToneAt } from '../../../components/common';
import { useAuth } from '../../auth/AuthContext';
import { recommendCareers, type CareerRecommendations } from '../career.service';
import {
  FIT_DISCLAIMER,
  NEAR_FIT_NOTE,
  PRELIMINARY_NOTE,
  RESULT_STATUS_LABEL,
  formatPercent,
  interestLabel,
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
          <span>Độ đầy đủ dữ liệu <b>{completeness}%</b></span>
          <span className="fit-bar-track"><span className="fit-bar-fill" style={{ width: `${completeness}%` }} /></span>
        </span>
        {next && <Link className="fit-next" to={next.to}>{next.label} <ArrowRight size={15} aria-hidden="true" /></Link>}
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
          <article className="fit-hero sticker-tone-gold">
            <div className="fit-hero-visual">
              <span className="fit-hero-crown">
                <Trophy size={14} aria-hidden="true" />
                Hạng {top.rank}
              </span>
              <FitRing percent={top.fitPercent} size={136} />
            </div>
            <div className="fit-hero-body">
              <div className="fit-hero-top">
                <span className="fit-eyebrow">
                  <Sparkles size={14} aria-hidden="true" />
                  {top.nearThreshold ? 'Gần phù hợp nhất' : 'Phù hợp nhất'}
                </span>
                <div className="career-chips">
                  {top.hollandTop3 && <span className="fit-holland-tag">{interestLabel(top.hollandTop3)}</span>}
                  {top.nearThreshold && <Badge variant="warning">Nghề gần đạt</Badge>}
                  {top.isTarget && <Badge variant="success">Mục tiêu</Badge>}
                </div>
              </div>
              <h2><Link to={careerHref(top.careerId)} className="fit-card-title">{top.careerName}</Link></h2>
              <FitBars result={top.result} />
              <div className="fit-actions">
                <Button onClick={() => navigate(careerHref(top.careerId))} rightIcon={<ArrowRight size={16} />}>Xem chi tiết</Button>
                {compareButton(top.careerId)}
              </div>
            </div>
          </article>

          {rest.length > 0 && (
            <ul className="fit-grid" aria-label="Các nghề phù hợp tiếp theo">
              {rest.map((item, index) => (
                <li key={item.careerId} className={`fit-card sticker-tone-${stickerToneAt(index)}`}>
                  <div className="fit-card-head">
                    <FitRing percent={item.fitPercent} size={68} />
                    <div className="fit-card-heading">
                      <div className="fit-card-meta">
                        <span className="fit-card-rank">#{item.rank}</span>
                        {item.nearThreshold && <Badge variant="warning" size="sm">Nghề gần đạt</Badge>}
                        {item.isTarget && <Badge variant="success" size="sm">Mục tiêu</Badge>}
                      </div>
                      <Link to={careerHref(item.careerId)} className="fit-card-title">{item.careerName}</Link>
                      {item.hollandTop3 && <span className="fit-holland-tag">{interestLabel(item.hollandTop3)}</span>}
                    </div>
                  </div>
                  <FitBars result={item.result} />
                  <div className="fit-card-foot">
                    <Link to={careerHref(item.careerId)} className="sticker-link">
                      Xem chi tiết
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    {compareButton(item.careerId, 'sm')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {extraTargets.length > 0 && (
        <section className="fit-targets">
          <h3><Target size={18} aria-hidden="true" /> Nghề mục tiêu</h3>
          <ul className="fit-grid">
            {extraTargets.map((item, index) => (
              <li key={item.careerId} className={`fit-card sticker-tone-${stickerToneAt(index + 3)}`}>
                <div className="fit-card-head">
                  {item.fitPercent === null ? <span className="fit-card-missing">{formatPercent(null)}</span> : <FitRing percent={item.fitPercent} size={68} />}
                  <div className="fit-card-heading">
                    <div className="fit-card-meta">
                      <Badge variant="success" size="sm">Mục tiêu</Badge>
                      {item.nearThreshold && <Badge variant="warning" size="sm">Nghề gần đạt</Badge>}
                    </div>
                    <Link to={careerHref(item.careerId)} className="fit-card-title">{item.careerName}</Link>
                  </div>
                </div>
                {item.fitPercent !== null && <FitBars result={item.result} />}
                <div className="fit-card-foot">
                  <Link to={careerHref(item.careerId)} className="sticker-link">
                    Xem chi tiết
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
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
