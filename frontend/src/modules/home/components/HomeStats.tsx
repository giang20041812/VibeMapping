import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { useCountUp } from '../../../hooks/useCountUp';
import { useInView } from '../../../hooks/useInView';
import './HomeStats.css';

export interface ExploreItem {
  key: string;
  /** Số lượng; null khi chưa tải được thì chỉ hiện nhãn */
  value: number | null;
  label: string;
  icon: LucideIcon;
  to: string;
}

/** Số đếm dần khi thẻ hiện ra */
const CountValue: React.FC<{ value: number; run: boolean }> = ({ value, run }) => {
  const counted = useCountUp(run ? value : null, 1200);
  return <>{Math.round(run ? (counted ?? 0) : 0).toLocaleString('vi-VN')}</>;
};

/** Ba thẻ khám phá đều nhau: biểu tượng, số lượng, nhãn và mũi tên; hiện nối tiếp khi cuộn tới */
export const ExploreLinks: React.FC<{ items: ExploreItem[] }> = ({ items }) => {
  const { ref, seen } = useInView<HTMLUListElement>(0.2);
  return (
    <ul ref={ref} className={`explore-links ${seen ? 'is-in' : ''}`}>
      {items.map(({ key, value, label, icon: Icon, to }, i) => (
        <li key={key} className="explore-item" style={{ '--d': i } as React.CSSProperties}>
          <Link to={to} className="explore-link">
            <span className="explore-icon" aria-hidden="true">
              <Icon size={22} strokeWidth={2} />
            </span>
            <span className="explore-text">
              {value !== null && (
                <b className="explore-value">
                  <CountValue value={value} run={seen} />
                </b>
              )}
              <span className="explore-label">{label}</span>
            </span>
            <ArrowUpRight className="explore-arrow" size={22} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
};
