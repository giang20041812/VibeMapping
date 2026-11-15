import React, { useEffect, useId, useState } from 'react';
import { UserRound, type LucideIcon } from 'lucide-react';
import { useInView } from '../../../hooks/useInView';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import './Rater360.css';

/** Một nhóm người đánh giá đặt trên vòng quanh người được đánh giá */
export interface RaterNode {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export interface Rater360Props {
  nodes: RaterNode[];
  /** Nhãn của người được đánh giá ở tâm */
  centerLabel?: string;
  /** Tắt: chuyển xám, ngừng tín hiệu */
  active?: boolean;
  /** Bản thu gọn làm hình của nút gạt: không nhãn, không tự chuyển nhóm */
  compact?: boolean;
  className?: string;
}

const SIZE = 400;
const CENTER = SIZE / 2;
const ORBIT = 138;
const INNER = 64;
const TOUR_MS = 2600;

/** Góc của nút thứ i: chia đều vòng tròn, lệch nửa bước để bốn nhóm nằm ở bốn góc chéo */
const pointAt = (index: number, count: number, radius: number) => {
  const angle = ((-90 + 360 / count / 2 + (360 / count) * index) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
};
const pct = (value: number) => `${((value / SIZE) * 100).toFixed(3)}%`;

/**
 * Sơ đồ đánh giá 360°: người được đánh giá ở tâm, các nhóm người đánh giá đều quanh một vòng,
 * tín hiệu chạy từ từng nhóm vào tâm. Hiện ra một lần theo thứ tự tâm, vòng, các nhóm, đường nối;
 * sau đó tự làm nổi lần lượt từng nhóm khi đang trong tầm nhìn.
 */
export const Rater360: React.FC<Rater360Props> = ({ nodes, centerLabel = 'Bạn', active = true, compact = false, className = '' }) => {
  const { ref, inView, seen } = useInView<HTMLElement>(0.25);
  const reduced = useReducedMotion();
  const haloId = `rater360-halo-${useId().replace(/:/g, '')}`;
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tour, setTour] = useState(0);
  const count = nodes.length;
  const touring = !compact && active && inView && !reduced && hoverKey === null && count > 0;

  useEffect(() => {
    if (!touring) return;
    const id = window.setInterval(() => setTour((i) => (i + 1) % count), TOUR_MS);
    return () => window.clearInterval(id);
  }, [touring, count]);

  const activeKey = compact || !active ? null : (hoverKey ?? nodes[tour % Math.max(count, 1)]?.key ?? null);
  const points = nodes.map((_, i) => pointAt(i, count, ORBIT));

  return (
    <figure
      ref={ref}
      className={`rater360 ${seen ? 'is-visible' : ''} ${active ? '' : 'is-off'} ${compact ? 'is-compact' : ''} ${className}`}
    >
      <div className="rater360-stage">
        <svg className="rater360-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <defs>
            <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" className="rater360-halo-in" />
              <stop offset="100%" className="rater360-halo-out" />
            </radialGradient>
          </defs>
          <circle cx={CENTER} cy={CENTER} r={ORBIT + 40} className="rater360-halo" fill={`url(#${haloId})`} />
          <circle cx={CENTER} cy={CENTER} r={ORBIT} className="rater360-ring rater360-orbit" pathLength={1} />
          <circle cx={CENTER} cy={CENTER} r={INNER + 18} className="rater360-ring rater360-inner" pathLength={1} />
          {points.map((p, i) => {
            const key = nodes[i].key;
            const lit = key === activeKey;
            return (
              <g key={key} className={`rater360-link ${lit ? 'is-lit' : ''}`} style={{ '--i': i } as React.CSSProperties}>
                <line x1={p.x} y1={p.y} x2={CENTER} y2={CENTER} className="rater360-line" pathLength={1} />
                <line x1={p.x} y1={p.y} x2={CENTER} y2={CENTER} className="rater360-signal" pathLength={1} />
              </g>
            );
          })}
        </svg>

        <span className="rater360-center" aria-hidden="true">
          <span className="rater360-pulse" />
          <span className="rater360-avatar">
            <UserRound strokeWidth={2.2} />
          </span>
          {!compact && <span className="rater360-center-label">{centerLabel}</span>}
        </span>

        {nodes.map(({ key, label, Icon }, i) => {
          const p = points[i];
          const dx = CENTER - p.x;
          const dy = CENTER - p.y;
          return (
            <span
              key={key}
              className={`rater360-node ${key === activeKey ? 'is-active' : ''}`}
              style={
                {
                  left: pct(p.x),
                  top: pct(p.y),
                  '--i': i,
                  '--dx': (dx / SIZE).toFixed(4),
                  '--dy': (dy / SIZE).toFixed(4),
                } as React.CSSProperties
              }
              onPointerEnter={() => setHoverKey(key)}
              onPointerLeave={() => setHoverKey(null)}
            >
              <span className="rater360-badge" aria-hidden="true">
                <Icon strokeWidth={2.2} />
              </span>
              {!compact && <span className="rater360-label">{label}</span>}
            </span>
          );
        })}
      </div>
      <figcaption className="sr-only">
        {centerLabel}: {nodes.map((n) => n.label).join(', ')}
      </figcaption>
    </figure>
  );
};
