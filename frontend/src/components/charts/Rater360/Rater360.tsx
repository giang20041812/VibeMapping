import React, { useEffect, useId, useState } from 'react';
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
  /** Thông tin phụ hiển thị dưới tên nhóm (ví dụ: "2/2 bài") */
  meta?: string;
  /** Số liệu nổi bật ở cạnh phải thẻ (ví dụ: "94%") */
  value?: string;
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

interface Layout {
  w: number;
  h: number;
  /** Tọa độ 4 góc cân xứng, nối thẳng một mạch từ tâm ra từng nhóm */
  nodes: { x: number; y: number }[];
  /** Bán kính vòng quỹ đạo; điểm nối nằm đúng trên vòng này */
  orbit: number;
  halo: number;
  inner: number;
}

/* Tỷ lệ w/h của từng bố cục phải trùng aspect-ratio trong Rater360.css */

/** Khung rộng (máy tính, máy tính bảng): thẻ ngang ở 4 góc */
const WIDE: Layout = {
  w: 540,
  h: 300,
  nodes: [
    { x: 104, y: 58 },
    { x: 436, y: 58 },
    { x: 436, y: 242 },
    { x: 104, y: 242 },
  ],
  orbit: 104,
  halo: 126,
  inner: 54,
};

/** Khung hẹp (điện thoại): sơ đồ cao hơn để thẻ dựng đứng không chồng lên nhau */
const NARROW: Layout = {
  w: 360,
  h: 340,
  nodes: [
    { x: 76, y: 62 },
    { x: 284, y: 62 },
    { x: 284, y: 278 },
    { x: 76, y: 278 },
  ],
  orbit: 78,
  halo: 98,
  inner: 42,
};

/** Bản thu gọn trong nút gạt: khung vuông */
const COMPACT: Layout = {
  w: 300,
  h: 300,
  nodes: [
    { x: 66, y: 66 },
    { x: 234, y: 66 },
    { x: 234, y: 234 },
    { x: 66, y: 234 },
  ],
  orbit: 84,
  halo: 110,
  inner: 46,
};

/** Dưới bề rộng này (px) chuyển sang bố cục khung hẹp */
const NARROW_BELOW = 460;

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
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (compact || !element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < NARROW_BELOW));
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact, ref]);

  const layout = compact ? COMPACT : narrow ? NARROW : WIDE;
  const { w: W, h: H } = layout;
  const CX = W / 2;
  const CY = H / 2;
  const pctX = (value: number) => `${((value / W) * 100).toFixed(2)}%`;
  const pctY = (value: number) => `${((value / H) * 100).toFixed(2)}%`;
  const points = nodes.map((_, i) => layout.nodes[i % layout.nodes.length]);

  return (
    <figure
      ref={ref}
      className={`rater360 ${seen ? 'is-visible' : ''} ${active ? '' : 'is-off'} ${compact ? 'is-compact' : ''} ${narrow && !compact ? 'is-narrow' : ''} ${className}`}
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

          <circle cx={CX} cy={CY} r={layout.halo} className="rater360-halo" fill={`url(#${haloId})`} />
          <circle cx={CX} cy={CY} r={layout.orbit} className="rater360-ring rater360-orbit" pathLength={1} />
          <circle cx={CX} cy={CY} r={layout.inner} className="rater360-ring rater360-inner" pathLength={1} />

          {/* Đường thẳng nối trực tiếp từ tâm ra 4 nhóm đánh giá */}
          {points.map((p, i) => {
            const key = nodes[i]?.key ?? String(i);
            const lit = key === hoverKey;
            const len = Math.hypot(p.x - CX, p.y - CY);
            const jointX = CX + ((p.x - CX) * layout.orbit) / len;
            const jointY = CY + ((p.y - CY) * layout.orbit) / len;
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
                {!compact && <circle cx={jointX} cy={jointY} r={3.5} className="rater360-joint" />}
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

        {nodes.map(({ key, label, Icon, meta, value }, i) => {
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
                <Icon strokeWidth={2} />
              </span>
              {!compact && (
                <span className="rater360-caption">
                  <span className="rater360-label">{label}</span>
                  {meta && <span className="rater360-meta">{meta}</span>}
                </span>
              )}
              {!compact && value && <span className="rater360-value">{value}</span>}
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
