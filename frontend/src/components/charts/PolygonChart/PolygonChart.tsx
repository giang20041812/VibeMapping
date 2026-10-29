import React, { memo, useCallback, useId, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../../../hooks/useCountUp';
import { useInView } from '../../../hooks/useInView';
import './PolygonChart.css';

export interface PolygonAxis {
  key: string;
  label: string;
  /** Tên ngắn dưới biểu tượng; mặc định dùng label */
  shortLabel?: string;
  /** Điểm 0–100; null là chưa đủ dữ liệu */
  value: number | null;
  /** Điểm so sánh (ví dụ tự đánh giá), vẽ bằng đường nét đứt */
  reference?: number | null;
  icon: LucideIcon;
}

export interface PolygonLevel {
  min: number;
  label: string;
}

export interface PolygonChartProps {
  /** Từ 3 trục trở lên, thứ tự theo chiều kim đồng hồ từ đỉnh */
  axes: PolygonAxis[];
  /** Thang mức năng lực; bỏ trống thì chỉ hiện điểm % */
  levels?: PolygonLevel[];
  valueLabel?: string;
  referenceLabel?: string;
  noDataLabel?: string;
  /** Hiện dòng số đọc (điểm và mức) của trục đang chọn; mặc định bật */
  showReadout?: boolean;
  /** Hiện điểm % ngay dưới tên mỗi nhóm; mặc định tắt */
  showNodeValues?: boolean;
  className?: string;
}

const CENTER = 50;
const RADIUS = 27;
const NODE_RATIO = 1.28;
const RINGS = [25, 50, 75, 100];
const TONE_COUNT = 7;

const fmt = (n: number) => n.toFixed(2);
const toneOf = (index: number) => (index % TONE_COUNT) + 1;
const clampScore = (value: number | null | undefined) => (value === null || value === undefined ? 0 : Math.max(0, Math.min(value, 100)));

interface Point {
  x: number;
  y: number;
}

interface Geometry {
  count: number;
  outer: Point[];
  data: Point[];
  reference: Point[] | null;
  nodes: Point[];
  rings: { ring: number; path: string }[];
  referencePath: string | null;
  hits: string[];
}

const toPath = (points: Point[]) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ') + ' Z';

function buildGeometry(axes: PolygonAxis[]): Geometry {
  const count = axes.length;
  const pointAt = (index: number, ratio: number): Point => {
    const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
    return { x: CENTER + RADIUS * ratio * Math.cos(angle), y: CENTER + RADIUS * ratio * Math.sin(angle) };
  };
  const outer = axes.map((_, i) => pointAt(i, 1));
  const hasReference = axes.some((a) => a.reference !== undefined);
  const reference = hasReference ? axes.map((a, i) => pointAt(i, clampScore(a.reference) / 100)) : null;
  return {
    count,
    outer,
    data: axes.map((a, i) => pointAt(i, clampScore(a.value) / 100)),
    reference,
    nodes: axes.map((_, i) => pointAt(i, NODE_RATIO)),
    rings: RINGS.map((ring) => ({ ring, path: toPath(axes.map((_, i) => pointAt(i, ring / 100))) })),
    referencePath: reference ? toPath(reference) : null,
    hits: axes.map((_, i) => toPath([{ x: CENTER, y: CENTER }, pointAt(i - 0.5, 1.15), pointAt(i, 1.15), pointAt(i + 0.5, 1.15)])),
  };
}

/* ---------- Lớp nền: vòng chia, trục, khung màu (tĩnh, chỉ vẽ lại khi đổi trục được chọn) ---------- */

interface PlateProps {
  geometry: Geometry;
  uid: string;
  /** Trục đang rê chuột hoặc được chọn; null khi chưa có */
  activeIndex: number | null;
}

const BasePlate = memo(function BasePlate({ geometry, uid, activeIndex }: PlateProps) {
  const { count, outer } = geometry;
  return (
    <svg className="polygon-svg polygon-svg-base" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0" className="polygon-stop-core" />
          <stop offset="1" className="polygon-stop-clear" />
        </radialGradient>
        {outer.map((point, i) => {
          const to = outer[(i + 1) % count];
          return (
            <linearGradient key={`frame-${i}`} id={`${uid}-frame-${i}`} gradientUnits="userSpaceOnUse" x1={point.x} y1={point.y} x2={to.x} y2={to.y}>
              <stop offset="0" className={`polygon-stop-${toneOf(i)}`} />
              <stop offset="1" className={`polygon-stop-${toneOf(i + 1)}`} />
            </linearGradient>
          );
        })}
        {outer.map((point, i) => (
          <linearGradient key={`spoke-${i}`} id={`${uid}-spoke-${i}`} gradientUnits="userSpaceOnUse" x1={CENTER} y1={CENTER} x2={point.x} y2={point.y}>
            <stop offset="0" className="polygon-stop-line" />
            <stop offset="1" className={`polygon-stop-${toneOf(i)}`} />
          </linearGradient>
        ))}
      </defs>

      <circle cx={CENTER} cy={CENTER} r={RADIUS * 1.05} fill={`url(#${uid}-core)`} />

      {geometry.rings.map(({ ring, path }, i) => (
        <path key={ring} d={path} className={`polygon-ring ${i % 2 === 0 ? 'is-tinted' : ''}`} />
      ))}

      {outer.map((point, i) => (
        <line
          key={`spoke-${i}`}
          x1={CENTER}
          y1={CENTER}
          x2={point.x}
          y2={point.y}
          stroke={`url(#${uid}-spoke-${i})`}
          className={`polygon-spoke ${activeIndex === i ? 'is-active' : ''}`}
        />
      ))}

      {outer.map((point, i) => {
        const to = outer[(i + 1) % count];
        return <line key={`frame-${i}`} x1={point.x} y1={point.y} x2={to.x} y2={to.y} stroke={`url(#${uid}-frame-${i})`} className="polygon-frame" />;
      })}
    </svg>
  );
});

/* ---------- Lớp dữ liệu: các múi màu, cạnh, đỉnh, vùng bắt chuột ---------- */

interface DataPlateProps extends PlateProps {
  keys: string[];
  filled: boolean[];
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
}

const DataPlate = memo(function DataPlate({ geometry, uid, activeIndex, keys, filled, onHover, onSelect }: DataPlateProps) {
  const { count, data, reference } = geometry;
  const active = activeIndex === null ? null : data[activeIndex];
  return (
    <div className="polygon-layer">
      <svg className="polygon-svg polygon-svg-data" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          {data.map((point, i) => {
            const to = data[(i + 1) % count];
            return (
              <linearGradient key={`data-${i}`} id={`${uid}-data-${i}`} gradientUnits="userSpaceOnUse" x1={point.x} y1={point.y} x2={to.x} y2={to.y}>
                <stop offset="0" className={`polygon-stop-${toneOf(i)}`} />
                <stop offset="1" className={`polygon-stop-${toneOf(i + 1)}`} />
              </linearGradient>
            );
          })}
        </defs>

        {data.map((point, i) => {
          const to = data[(i + 1) % count];
          const touched = activeIndex === i || activeIndex === (i + 1) % count;
          return (
            <path
              key={`wedge-${i}`}
              d={toPath([{ x: CENTER, y: CENTER }, point, to])}
              fill={`url(#${uid}-data-${i})`}
              className={`polygon-wedge ${touched ? 'is-active' : ''}`}
            />
          );
        })}

        {reference && geometry.referencePath && <path d={geometry.referencePath} className="polygon-reference" />}

        {data.map((point, i) => {
          const to = data[(i + 1) % count];
          return <line key={`glow-${i}`} x1={point.x} y1={point.y} x2={to.x} y2={to.y} stroke={`url(#${uid}-data-${i})`} className="polygon-edge-glow" />;
        })}
        {data.map((point, i) => {
          const to = data[(i + 1) % count];
          return <line key={`edge-${i}`} x1={point.x} y1={point.y} x2={to.x} y2={to.y} stroke={`url(#${uid}-data-${i})`} className="polygon-edge" />;
        })}

        {data.map((point, i) => (
          <circle
            key={`dot-${keys[i]}`}
            cx={point.x}
            cy={point.y}
            r={1.9}
            className={`polygon-dot polygon-tone-${toneOf(i)} ${activeIndex === i ? 'is-active' : ''} ${filled[i] ? '' : 'is-empty'}`}
          />
        ))}

        {geometry.hits.map((path, i) => (
          <path
            key={`hit-${keys[i]}`}
            d={path}
            className="polygon-hit"
            onPointerEnter={() => onHover(keys[i])}
            onPointerLeave={() => onHover(null)}
            onClick={() => onSelect(keys[i])}
          />
        ))}
      </svg>
      {active && activeIndex !== null && (
        <span key={`halo-${activeIndex}`} className={`polygon-halo polygon-tone-${toneOf(activeIndex)}`} style={{ left: `${fmt(active.x)}%`, top: `${fmt(active.y)}%` }} />
      )}
    </div>
  );
});

/* ---------- Số đọc: tách riêng để hiệu ứng đếm không vẽ lại cả biểu đồ ---------- */

interface ReadoutProps {
  axis: PolygonAxis;
  tone: number;
  level: string | null;
  referenceLevel?: string;
  valueLabel?: string;
  referenceLabel?: string;
  noDataLabel: string;
}

const Readout: React.FC<ReadoutProps> = ({ axis, tone, level, valueLabel, referenceLabel, noDataLabel }) => {
  const count = useCountUp(axis.value, 650);
  const hasReference = axis.reference !== undefined;
  return (
    <span className={`polygon-readout-line polygon-tone-${tone}`}>
      <span className="polygon-readout-dot" aria-hidden="true" />
      <strong className="polygon-readout-name">{axis.label}</strong>
      {valueLabel && hasReference && <span className="polygon-readout-caption">{valueLabel}</span>}
      <span className="polygon-readout-value">{axis.value === null ? noDataLabel : `${Math.round(count ?? axis.value)}%`}</span>
      {level && <span className="polygon-readout-level">{level}</span>}
      {hasReference && (
        <span className="polygon-readout-reference">
          {referenceLabel} {axis.reference === null || axis.reference === undefined ? noDataLabel : `${Math.round(axis.reference)}%`}
        </span>
      )}
    </span>
  );
};

/**
 * Biểu đồ đa giác cho nền tối: mỗi trục một màu. Đứng yên, chỉ làm nổi trục khi rê chuột, tab vào hoặc chạm chọn.
 * Tối ưu: lớp tĩnh và lớp dữ liệu được ghi nhớ, hoạt ảnh chỉ dùng transform/opacity, không dùng bộ lọc.
 */
export const PolygonChart: React.FC<PolygonChartProps> = ({
  axes,
  levels,
  valueLabel,
  referenceLabel = 'Tự đánh giá',
  noDataLabel = 'Chưa đủ dữ liệu',
  showReadout = true,
  showNodeValues = false,
  className = '',
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { ref: figureRef, seen } = useInView<HTMLElement>(0.25);

  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  const count = axes.length;
  const valid = count >= 3;
  const interacting = hoverKey !== null || pinnedKey !== null;

  const geometry = useMemo(() => (valid ? buildGeometry(axes) : null), [axes, valid]);
  const keys = useMemo(() => axes.map((a) => a.key), [axes]);
  const filled = useMemo(() => axes.map((a) => a.value !== null), [axes]);

  const levelOf = useCallback(
    (value: number | null | undefined) => {
      if (value === null || value === undefined) return noDataLabel;
      if (!levels?.length) return null;
      return (levels.find((l) => value >= l.min) ?? levels[levels.length - 1]).label;
    },
    [levels, noDataLabel],
  );

  const select = useCallback((key: string) => setPinnedKey((current) => (current === key ? null : key)), []);

  if (!valid || !geometry) return null;

  const activeKey = hoverKey ?? pinnedKey;
  const foundIndex = activeKey === null ? -1 : axes.findIndex((a) => a.key === activeKey);
  const activeIndex = foundIndex >= 0 ? foundIndex : null;
  const active = activeIndex === null ? null : axes[activeIndex];
  const hasReference = geometry.reference !== null;

  return (
    <figure ref={figureRef} className={`polygon-chart ${seen ? 'is-visible' : ''} ${interacting ? 'is-interacting' : ''} ${className}`}>
      <div className="polygon-stage">
        <div className="polygon-layer">
          <BasePlate geometry={geometry} uid={uid} activeIndex={activeIndex} />
        </div>

        <DataPlate
          geometry={geometry}
          uid={uid}
          activeIndex={activeIndex}
          keys={keys}
          filled={filled}
          onHover={setHoverKey}
          onSelect={select}
        />

        {axes.map((axis, i) => {
          const Icon = axis.icon;
          const p = geometry.nodes[i];
          return (
            <button
              key={axis.key}
              type="button"
              className={`polygon-node polygon-tone-${toneOf(i)} ${activeIndex === i ? 'is-active' : ''}`}
              style={{ left: `${fmt(p.x)}%`, top: `${fmt(p.y)}%` }}
              onPointerEnter={() => setHoverKey(axis.key)}
              onPointerLeave={() => setHoverKey(null)}
              onFocus={() => setHoverKey(axis.key)}
              onBlur={() => setHoverKey(null)}
              onClick={() => select(axis.key)}
              aria-pressed={pinnedKey === axis.key}
              aria-label={`${axis.label}: ${axis.value === null ? noDataLabel : `${Math.round(axis.value)}%`}`}
            >
              <span className="polygon-node-badge">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="polygon-node-name">{axis.shortLabel ?? axis.label}</span>
              {showNodeValues && <span className="polygon-node-value">{axis.value === null ? '–' : `${Math.round(axis.value)}%`}</span>}
            </button>
          );
        })}
      </div>

      {showReadout && (
        <figcaption className="polygon-readout" aria-live="polite">
          {active && activeIndex !== null && (
            <Readout
              key={active.key}
              axis={active}
              tone={toneOf(activeIndex)}
              level={levelOf(active.value)}
              valueLabel={valueLabel}
              referenceLabel={referenceLabel}
              noDataLabel={noDataLabel}
            />
          )}
        </figcaption>
      )}

      <table className="sr-only">
        <caption>Biểu đồ đa giác các nhóm tiêu chí</caption>
        <thead>
          <tr>
            <th scope="col">Nhóm tiêu chí</th>
            <th scope="col">{valueLabel ?? 'Điểm'}</th>
            {hasReference && <th scope="col">{referenceLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {axes.map((axis) => (
            <tr key={axis.key}>
              <th scope="row">{axis.label}</th>
              <td>{axis.value === null ? noDataLabel : levelOf(axis.value) ? `${Math.round(axis.value)}% – ${levelOf(axis.value)}` : `${Math.round(axis.value)}%`}</td>
              {hasReference && <td>{axis.reference === null || axis.reference === undefined ? noDataLabel : `${Math.round(axis.reference)}%`}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};
