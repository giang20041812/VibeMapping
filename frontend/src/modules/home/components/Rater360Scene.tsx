import React, { useId } from 'react';
import type { RaterNode } from '../../../components/charts/Rater360/Rater360';
import './Rater360Scene.css';

/* Hệ tọa độ cảnh; tỷ lệ W/H phải trùng aspect-ratio trong Rater360Scene.css */
const W = 560;
const H = 295;
const CENTER = { x: 280, y: 165 };
const FLOOR = { rx: 252, ry: 120 };
const RING = { rx: 204, ry: 100 };
const PEDESTAL = { rx: 46, ry: 16, h: 10 };
const CENTER_SCALE = 1.25;
const LABEL_GAP = 12;

interface Placed {
  key: string;
  label: string;
  x: number;
  y: number;
  s: number;
}

/** Đặt các nhóm cách đều trên vòng sàn phối cảnh; nhóm ở xa nhỏ hơn nhóm ở gần */
function placeRaters(raters: RaterNode[]): Placed[] {
  const step = (Math.PI * 2) / Math.max(raters.length, 1);
  return raters.map((node, i) => {
    const angle = -Math.PI / 2 + step * (i + 0.5);
    const depth = Math.sin(angle);
    return {
      key: node.key,
      label: node.label,
      x: CENTER.x + RING.rx * Math.cos(angle),
      y: CENTER.y + RING.ry * depth,
      s: 0.93 + 0.06 * depth,
    };
  });
}

/** Hình người dạng khối: thân trụ bo tròn, đầu cầu, bóng đổ dưới chân (gốc tọa độ tại chân) */
const Figure: React.FC<{ x: number; y: number; s: number; body: string; head: string }> = ({ x, y, s, body, head }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="0" rx="24" ry="7" className="r3d-shadow" />
    <path
      d="M -21 -4 L -21 -38 C -21 -51 -12 -58 0 -58 C 12 -58 21 -51 21 -38 L 21 -4 A 21 6 0 0 1 -21 -4 Z"
      fill={`url(#${body})`}
    />
    <circle cx="0" cy="-74" r="14" fill={`url(#${head})`} />
  </g>
);

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Cảnh 3D tĩnh: bạn đứng giữa, các nhóm người đánh giá đứng quanh trên cùng một mặt sàn */
export const Rater360Scene: React.FC<{ raters: RaterNode[]; centerLabel: string }> = ({ raters, centerLabel }) => {
  const uid = useId().replace(/:/g, '');
  const ids = {
    raterBody: `${uid}-rb`,
    raterHead: `${uid}-rh`,
    selfBody: `${uid}-sb`,
    selfHead: `${uid}-sh`,
    floor: `${uid}-fl`,
  };

  const placed = placeRaters(raters);
  const back = placed.filter((p) => p.y <= CENTER.y);
  const front = placed.filter((p) => p.y > CENTER.y);
  const pedestalTop = CENTER.y - PEDESTAL.h;

  const renderRater = (p: Placed) => (
    <Figure key={p.key} x={p.x} y={p.y} s={p.s} body={ids.raterBody} head={ids.raterHead} />
  );

  return (
    <div className="r3d">
      <svg className="r3d-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id={ids.raterBody} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" className="r3d-rater-hi" />
            <stop offset="55%" className="r3d-rater-mid" />
            <stop offset="100%" className="r3d-rater-lo" />
          </linearGradient>
          <radialGradient id={ids.raterHead} cx="38%" cy="32%" r="72%">
            <stop offset="0%" className="r3d-rater-hi" />
            <stop offset="60%" className="r3d-rater-mid" />
            <stop offset="100%" className="r3d-rater-lo" />
          </radialGradient>
          <linearGradient id={ids.selfBody} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" className="r3d-self-hi" />
            <stop offset="55%" className="r3d-self-mid" />
            <stop offset="100%" className="r3d-self-lo" />
          </linearGradient>
          <radialGradient id={ids.selfHead} cx="38%" cy="32%" r="72%">
            <stop offset="0%" className="r3d-self-hi" />
            <stop offset="60%" className="r3d-self-mid" />
            <stop offset="100%" className="r3d-self-lo" />
          </radialGradient>
          <radialGradient id={ids.floor} cx="50%" cy="50%" r="50%">
            <stop offset="0%" className="r3d-floor-in" />
            <stop offset="100%" className="r3d-floor-out" />
          </radialGradient>
        </defs>

        {/* Mặt sàn phối cảnh */}
        <ellipse cx={CENTER.x} cy={CENTER.y} rx={FLOOR.rx} ry={FLOOR.ry} fill={`url(#${ids.floor})`} className="r3d-floor" />
        <ellipse cx={CENTER.x} cy={CENTER.y} rx={RING.rx} ry={RING.ry} className="r3d-ring" />

        {/* Đường nối từ từng nhóm vào giữa, nằm trên mặt sàn */}
        {placed.map((p) => (
          <line key={`link-${p.key}`} x1={p.x} y1={p.y} x2={CENTER.x} y2={CENTER.y} className="r3d-link" />
        ))}

        {back.map(renderRater)}

        {/* Bệ đứng ở giữa */}
        <path
          d={`M ${CENTER.x - PEDESTAL.rx} ${pedestalTop} L ${CENTER.x - PEDESTAL.rx} ${CENTER.y} A ${PEDESTAL.rx} ${PEDESTAL.ry} 0 0 0 ${CENTER.x + PEDESTAL.rx} ${CENTER.y} L ${CENTER.x + PEDESTAL.rx} ${pedestalTop} Z`}
          className="r3d-pedestal-side"
        />
        <ellipse cx={CENTER.x} cy={pedestalTop} rx={PEDESTAL.rx} ry={PEDESTAL.ry} className="r3d-pedestal-top" />
        <Figure x={CENTER.x} y={pedestalTop} s={CENTER_SCALE} body={ids.selfBody} head={ids.selfHead} />

        {front.map(renderRater)}
      </svg>

      <span
        className="r3d-label is-self"
        style={{ '--x': pct(CENTER.x, W), '--y': pct(CENTER.y + PEDESTAL.ry + LABEL_GAP * 0.5, H) } as React.CSSProperties}
      >
        {centerLabel}
      </span>
      {placed.map((p) => (
        <span
          key={`label-${p.key}`}
          className="r3d-label"
          style={{ '--x': pct(p.x, W), '--y': pct(p.y + LABEL_GAP, H) } as React.CSSProperties}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
};
