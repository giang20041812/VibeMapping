import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge } from '../../../components/common';
import { FIT_PARTS, interestLabel } from '../careerFit.constants';
import type { CareerComponentResult } from '../../../domain/assessmentRules';
import './TopCareers.css';
import '../pages/CareerFit.css';

export interface FitRowItem {
  careerId: string;
  careerName: string;
  fitPercent: number | null;
  nearThreshold: boolean;
  hollandTop3?: string | null;
  rank?: number;
  isTarget?: boolean;
  result: CareerComponentResult;
}

export const FitMeter: React.FC<{ percent: number | null }> = ({ percent }) => (
  <span className="fit-bar-track">
    <span className="fit-bar-fill" style={{ width: `${percent ?? 0}%` }} />
  </span>
);

interface FitRowProps {
  item: FitRowItem;
  /** Không có đường dẫn: dòng chỉ để xem (bản minh họa), không có cột hành động */
  href?: string;
  isTop?: boolean;
  compare?: React.ReactNode;
}

/** Một dòng nghề: hạng, tên cùng thẻ thông tin, mức phù hợp tổng và ba thành phần, mỗi số kèm một đường thẳng */
export const FitRow: React.FC<FitRowProps> = ({ item, href, isTop = false, compare }) => {
  const { result } = item;
  const unmet = result.unmetCriteriaCount;
  const completeness = Math.round(result.componentCompleteness * 100);
  return (
    <li className={`fit-row${isTop ? ' is-top' : ''}`}>
      <span className="fit-row-rank">{item.rank ?? '–'}</span>
      <div className="fit-row-main">
        {href ? (
          <Link to={href} className="fit-row-title">{item.careerName}</Link>
        ) : (
          <span className="fit-row-title">{item.careerName}</span>
        )}
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
        <FitMeter percent={item.fitPercent} />
      </div>
      <ul className="fit-row-parts">
        {FIT_PARTS.map(({ key, label }) => {
          const percent = result[key].matchPercent;
          return (
            <li key={key}>
              <span className="fit-row-part-label">{label}</span>
              <b>{percent === null ? '–' : `${Math.round(percent)}%`}</b>
              <FitMeter percent={percent} />
            </li>
          );
        })}
      </ul>
      {href && (
        <div className="fit-row-actions">
          {compare}
          <Link to={href} className="sticker-link" aria-label={`Xem chi tiết ${item.careerName}`}>
            Chi tiết
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
    </li>
  );
};

export const FitListHead: React.FC<{ withActions?: boolean }> = ({ withActions = true }) => (
  <div className="fit-list-head" aria-hidden="true">
    <span>Hạng</span>
    <span>Nghề</span>
    <span>Phù hợp</span>
    <span className="fit-list-head-parts">
      {FIT_PARTS.map(({ key, label }) => <span key={key}>{label}</span>)}
    </span>
    {withActions && <span />}
  </div>
);
