import React, { useId, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LearnerCenterIcon } from '../ArtifactIcons';
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

const W = 560;
const H = 300;
const CX = W / 2;
const CY = H / 2;

/** Tọa độ 4 góc thoáng đãng để thẻ chữ không bao giờ đè vào tâm */
const CORNER_POINTS = [
  { x: 108, y: 66, align: 'left' as const },
  { x: 452, y: 66, align: 'right' as const },
  { x: 452, y: 234, align: 'right' as const },
  { x: 108, y: 234, align: 'left' as const },
];

const pctX = (value: number) => `${((value / W) * 100).toFixed(2)}%`;
const pctY = (value: number) => `${((value / H) * 100).toFixed(2)}%`;

/**
 * Sơ đồ đánh giá 360° kiến trúc phẳng, thoáng chữ:
 * Tâm ở giữa, 4 nhóm người đánh giá nằm ở 4 góc rộng rãi, không bo tròn chồng chéo,
 * chỉ dùng chuyển động transform + opacity mượt trên GPU.
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
  const gradId = `rater360-line-${useId().replace(/:/g, '')}`;
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const points = nodes.map((_, i) => CORNER_POINTS[i % CORNER_POINTS.length]);

  return (
    <figure
      ref={ref}
      className={`rater360 ${seen ? 'is-visible' : ''} ${active ? '' : 'is-off'} ${compact ? 'is-compact' : ''} ${className}`}
    >
      <div className="rater360-stage">
        <svg className="rater360-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-soft)" stopOpacity="0.75" />
              <stop offset="100%" stopColor="var(--brand-coral)" stopOpacity="0.85" />
            </linearGradient>
          </defs>

          <rect
            x={CX - 178}
            y={CY - 92}
            width={356}
            height={184}
            rx={16}
            className="rater360-ring rater360-orbit"
            pathLength={1}
          />

          {points.map((p, i) => {
            const key = nodes[i]?.key ?? String(i);
            const lit = key === hoverKey;
            const elbowX = p.align === 'left' ? CX - 56 : CX + 56;
            const pathD = `M ${CX} ${CY} L ${elbowX} ${p.y} L ${p.x} ${p.y}`;
            return (
              <g key={key} className={`rater360-link ${lit ? 'is-lit' : ''}`} style={{ '--i': i } as React.CSSProperties}>
                <path d={pathD} className="rater360-line" pathLength={1} />
                <path
                  d={pathD}
                  className="rater360-line-accent"
                  stroke={`url(#${gradId})`}
                  pathLength={1}
                />
                {!compact && <circle cx={elbowX} cy={p.y} r={3} className="rater360-joint" />}
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
              className={`rater360-node is-${p.align} rater360-tone-${(i % 4) + 1} ${key === hoverKey ? 'is-active' : ''}`}
              style={
                {
                  left: pctX(p.x),
                  top: pctY(p.y),
                  '--i': i,
                } as React.CSSProperties
              }
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
