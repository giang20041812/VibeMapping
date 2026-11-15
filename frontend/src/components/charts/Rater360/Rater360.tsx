import React, { useId, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LearnerCenterIcon } from '../ArtifactIcons';
import { useInView } from '../../../hooks/useInView';
import './Rater360.css';

/** Một nhóm người đánh giá đặt trên vòng quanh người được đánh giá */
export interface RaterNode {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Thông tin phụ hiển thị dưới tên nhóm (ví dụ: "2/2 đã nộp · 94%") */
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

const SIZE = 400;
const CENTER = SIZE / 2;
const ORBIT = 136;
const INNER = 66;

/** Góc của nút thứ i: chia đều vòng tròn, lệch nửa bước để bốn nhóm nằm ở bốn góc cân xứng */
const pointAt = (index: number, count: number, radius: number) => {
  const angle = ((-90 + 360 / count / 2 + (360 / count) * index) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
};
const pct = (value: number) => `${((value / SIZE) * 100).toFixed(3)}%`;

/**
 * Sơ đồ đánh giá 360° phong cách Apple/Google:
 * Người được đánh giá ở tâm, 4 nhóm người đánh giá cân xứng xung quanh.
 * Chỉ dùng animation hiện ra hiện đại một lần (easeOutQuint) khi vào khung nhìn, không chạy vòng lặp gây rối mắt.
 */
export const Rater360: React.FC<Rater360Props> = ({
  nodes,
  centerLabel = 'Bạn',
  centerSub,
  active = true,
  compact = false,
  className = '',
}) => {
  const { ref, seen } = useInView<HTMLElement>(0.2);
  const haloId = `rater360-halo-${useId().replace(/:/g, '')}`;
  const gradId = `rater360-line-${useId().replace(/:/g, '')}`;
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const count = nodes.length;
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
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-soft)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--brand-coral)" stopOpacity="0.85" />
            </linearGradient>
          </defs>

          <circle cx={CENTER} cy={CENTER} r={ORBIT + 44} className="rater360-halo" fill={`url(#${haloId})`} />
          <circle cx={CENTER} cy={CENTER} r={ORBIT} className="rater360-ring rater360-orbit" pathLength={1} />
          <circle cx={CENTER} cy={CENTER} r={INNER + 16} className="rater360-ring rater360-inner" pathLength={1} />

          {points.map((p, i) => {
            const key = nodes[i].key;
            const lit = key === hoverKey;
            const midX = (p.x + CENTER) / 2;
            const midY = (p.y + CENTER) / 2;
            return (
              <g key={key} className={`rater360-link ${lit ? 'is-lit' : ''}`} style={{ '--i': i } as React.CSSProperties}>
                <line x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} className="rater360-line" pathLength={1} />
                <line
                  x1={CENTER}
                  y1={CENTER}
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
              className={`rater360-node rater360-tone-${(i % 4) + 1} ${key === hoverKey ? 'is-active' : ''}`}
              style={
                {
                  left: pct(p.x),
                  top: pct(p.y),
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
