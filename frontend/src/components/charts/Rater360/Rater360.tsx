import React, { useId, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LearnerCenterIcon } from '../ArtifactIcons';
import { trackPointer } from '../../common/MotionPrimitives';
import { useInView } from '../../../hooks/useInView';
import './Rater360.css';

/** Một nhóm người đánh giá đặt xung quanh người được đánh giá */
export interface RaterNode {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Thông tin phụ hiển thị dưới tên nhóm (ví dụ: "2/2 bài · 94%") */
  meta?: string;
}

export interface Rater360Props {
  nodes: RaterNode[];
  /** Nhãn của người được đánh giá ở tâm */
  centerLabel?: string;
  /** Phụ đề nhỏ dưới nhãn trung tâm */
  centerSub?: string;
  /** Tắt: chuyển xám */
  active?: boolean;
  /** Bản thu gọn làm hình của nút gạt: không nhãn, chỉ hiện biểu tượng */
  compact?: boolean;
  className?: string;
}

const W = 540;
const H = 300;
const CX = W / 2;
const CY = H / 2;

/** Tọa độ 4 góc cân xứng, nối thẳng một mạch từ tâm ra từng nhóm */
const NODE_POSITIONS = [
  { x: 108, y: 62 },
  { x: 432, y: 62 },
  { x: 432, y: 238 },
  { x: 108, y: 238 },
];

const pctX = (value: number) => `${((value / W) * 100).toFixed(2)}%`;
const pctY = (value: number) => `${((value / H) * 100).toFixed(2)}%`;

/**
 * Sơ đồ đánh giá 360° hiện đại:
 * Tâm ở giữa, 4 đường thẳng nối trực tiếp tới 4 thẻ nhóm đánh giá ở 4 góc thoáng đãng.
 */
export const Rater360: React.FC<Rater360Props> = ({
  nodes,
  centerLabel = 'Bạn',
  centerSub,
  active = true,
  compact = false,
  className = '',
}) => {
  const { ref, seen } = useInView<HTMLElement>(0.15);
  const haloId = `rater360-halo-${useId().replace(/:/g, '')}`;
  const gradId = `rater360-line-${useId().replace(/:/g, '')}`;
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const points = nodes.map((_, i) => NODE_POSITIONS[i % NODE_POSITIONS.length]);

  return (
    <figure
      ref={ref}
      className={`rater360 ${seen ? 'is-visible' : ''} ${active ? '' : 'is-off'} ${compact ? 'is-compact' : ''} ${className}`}
    >
      <div className="rater360-stage">
        <svg className="rater360-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" className="rater360-halo-in" />
              <stop offset="100%" className="rater360-halo-out" />
            </radialGradient>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-soft)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--brand-coral)" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          <circle cx={CX} cy={CY} r={126} className="rater360-halo" fill={`url(#${haloId})`} />
          <circle cx={CX} cy={CY} r={104} className="rater360-ring rater360-orbit" pathLength={1} />
          <circle cx={CX} cy={CY} r={54} className="rater360-ring rater360-inner" pathLength={1} />

          {/* Đường thẳng nối trực tiếp từ tâm ra 4 nhóm đánh giá */}
          {points.map((p, i) => {
            const key = nodes[i]?.key ?? String(i);
            const lit = key === hoverKey;
            const midX = (CX + p.x) / 2;
            const midY = (CY + p.y) / 2;
            return (
              <g key={key} className={`rater360-link ${lit ? 'is-lit' : ''}`} style={{ '--i': i } as React.CSSProperties}>
                <line x1={CX} y1={CY} x2={p.x} y2={p.y} className="rater360-line" pathLength={1} />
                <line
                  x1={CX}
                  y1={CY}
                  x2={p.x}
                  y2={p.y}
                  className="rater360-line-accent"
                  stroke={`url(#${gradId})`}
                  pathLength={1}
                />
                {!compact && <circle cx={midX} cy={midY} r={3} className="rater360-joint" />}
              </g>
            );
          })}
        </svg>

        <span className="rater360-center" aria-hidden="true">
          <span className="rater360-avatar">
            <LearnerCenterIcon strokeWidth={2} />
          </span>
          {!compact && (
            <span className="rater360-center-tag">
              <span className="rater360-center-label">{centerLabel}</span>
              {centerSub && <span className="rater360-center-sub">{centerSub}</span>}
            </span>
          )}
        </span>

        {nodes.map(({ key, label, Icon, meta }, i) => {
          const p = points[i];
          return (
            <span
              key={key}
              className={`rater360-node spotlight rater360-tone-${(i % 4) + 1} ${key === hoverKey ? 'is-active' : ''}`}
              style={
                {
                  left: pctX(p.x),
                  top: pctY(p.y),
                  '--i': i,
                } as React.CSSProperties
              }
              onPointerMove={trackPointer}
              onPointerEnter={() => setHoverKey(key)}
              onPointerLeave={() => setHoverKey(null)}
            >
              <span className="rater360-badge" aria-hidden="true">
                <Icon strokeWidth={1.9} />
              </span>
              {!compact && (
                <span className="rater360-caption">
                  <span className="rater360-label">{label}</span>
                  {meta && <span className="rater360-meta">{meta}</span>}
                </span>
              )}
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
