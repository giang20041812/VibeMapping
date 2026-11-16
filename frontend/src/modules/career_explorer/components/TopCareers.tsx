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
  interestLabel,
  nextSurveyStep,
} from '../careerFit.constants';
import type { CareerComponentResult } from '../../../domain/assessmentRules';
import './TopCareers.css';
import '../pages/CareerFit.css';

interface Props {
  picked?: string[];
  onToggleCompare?: (id: string) => void;
  onBrowse?: () => void;
  /** Phụ huynh xem nghề phù hợp của con đã chia sẻ kết quả: chỉ đọc */
  subjectUserId?: string;
}

const PARTS: Array<{ key: 'g1toG5' | 'g6' | 'g7'; label: string }> = [
  { key: 'g1toG5', label: 'Năng lực' },
  { key: 'g6', label: 'Sở thích' },
  { key: 'g7', label: 'Động lực' },
];

interface RowItem {
  careerId: string;
  careerName: string;
  fitPercent: number | null;
  nearThreshold: boolean;
  hollandTop3?: string | null;
  rank?: number;
  isTarget?: boolean;
  result: CareerComponentResult;
}

const Meter: React.FC<{ percent: number | null }> = ({ percent }) => (
  <span className="fit-bar-track">
    <span className="fit-bar-fill" style={{ width: `${percent ?? 0}%` }} />
  </span>
);

interface RowProps {
  item: RowItem;
  href: string;
  isTop?: boolean;
  compare: React.ReactNode;
}

/** Một dòng nghề: hạng, tên cùng thẻ thông tin, mức phù hợp tổng và ba thành phần, mỗi số kèm một đường thẳng */
const FitRow: React.FC<RowProps> = ({ item, href, isTop = false, compare }) => {
  const { result } = item;
  const unmet = result.unmetCriteriaCount;
  const completeness = Math.round(result.componentCompleteness * 100);
  return (
    <li className={`fit-row${isTop ? ' is-top' : ''}`}>
      <span className="fit-row-rank">{item.rank ?? '–'}</span>
      <div className="fit-row-main">
        <Link to={href} className="fit-row-title">{item.careerName}</Link>
        <div className="fit-row-tags">
          {isTop && <Badge variant="highlight" size="sm">{item.nearThreshold ? 'Gần phù hợp nhất' : 'Phù hợp nhất'}</Badge>}
          {item.isTarget && <Badge variant="success" size="sm">Mục tiêu</Badge>}
          {item.nearThreshold && !isTop && <Badge variant="warning" size="sm">Nghề gần đạt</Badge>}
          {item.hollandTop3 && <span className="fit-holland-tag">{interestLabel(item.hollandTop3)}</span>}
          {unmet > 0 && <span className="fit-row-meta">Chưa đạt {unmet} tiêu chí</span>}
          {completeness < 100 && <span className="fit-row-meta">Dữ liệu {completeness}%</span>}
        </div>
      </div>
      <div className="fit-row-total">
        {item.fitPercent === null ? (
          <b className="is-missing">–</b>
        ) : (
          <b>{Math.round(item.fitPercent)}<small>%</small></b>
        )}
        <Meter percent={item.fitPercent} />
      </div>
      <ul className="fit-row-parts">
        {PARTS.map(({ key, label }) => {
          const percent = result[key].matchPercent;
          return (
            <li key={key}>
              <span className="fit-row-part-label">{label}</span>
              <b>{percent === null ? '–' : `${Math.round(percent)}%`}</b>
              <Meter percent={percent} />
            </li>
          );
        })}
      </ul>
      <div className="fit-row-actions">
        {compare}
        <Link to={href} className="sticker-link" aria-label={`Xem chi tiết ${item.careerName}`}>
          Chi tiết
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
};

const ListHead: React.FC = () => (
  <div className="fit-list-head" aria-hidden="true">
    <span>Hạng</span>
    <span>Nghề</span>
    <span>Phù hợp</span>
    <span className="fit-list-head-parts">
      {PARTS.map(({ key, label }) => <span key={key}>{label}</span>)}
    </span>
    <span />
  </div>
);

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
          <Meter percent={completeness} />
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
            <ListHead />
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
            <ListHead />
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
