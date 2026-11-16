import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useInView } from '../../../hooks/useInView';
import './Rater360.css';

/** Một nhóm người đánh giá quay quanh người được đánh giá */
export interface RaterNode {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Thông tin phụ hiển thị dưới tên nhóm (ví dụ: "2/2 bài") */
  meta?: string;
  /** Số liệu nổi bật cạnh tên nhóm (ví dụ: "94%") */
  value?: string;
}

export interface Rater360Props {
  nodes: RaterNode[];
  /** Nhãn của người được đánh giá ở tâm */
  centerLabel?: string;
  /** Phụ đề nhỏ dưới nhãn trung tâm */
  centerSub?: string;
  /** Tắt: chuyển xám, các nhóm dừng quay */
  active?: boolean;
  /** Bản thu gọn làm hình của nút gạt: không nhãn, chỉ hiện biểu tượng */
  compact?: boolean;
  /** Tạm dừng quay (giữ nguyên vị trí), ví dụ khi cảnh đang bị che */
  paused?: boolean;
  className?: string;
}

/* Hệ tọa độ cảnh; tỷ lệ W/H phải trùng aspect-ratio trong Rater360.css */
const W = 400;
const H = 300;
const CX = 200;
const ORBIT = { cy: 162, rx: 172, ry: 48, tilt: -9 };
/** Một vòng quay hết bao nhiêu giây */
const TURN_SECONDS = 28;
/** Bảng màu nhóm theo thứ tự INVITE_GROUPS: phụ huynh, bạn bè, giáo viên, người hướng dẫn */
const TONES = ['gold', 'cyan', 'violet', 'magenta'] as const;

const TILT_RAD = (ORBIT.tilt * Math.PI) / 180;
const COS_T = Math.cos(TILT_RAD);
const SIN_T = Math.sin(TILT_RAD);

/** Vị trí một điểm trên quỹ đạo nghiêng; depth = 1 là gần nhất (phía trước), -1 là xa nhất (sau lưng) */
function orbitPoint(angle: number) {
  const ex = ORBIT.rx * Math.cos(angle);
  const ey = ORBIT.ry * Math.sin(angle);
  return {
    x: CX + ex * COS_T - ey * SIN_T,
    y: ORBIT.cy + ex * SIN_T + ey * COS_T,
    depth: Math.sin(angle),
  };
}

/**
 * Đặt một nhóm lên quỹ đạo bằng transform (chạy trên GPU, không bắt trình duyệt dàn lại bố cục mỗi khung hình).
 * Bong bóng theo lớp trước/sau hình người; nhãn luôn nằm trên cùng để không bị vành che và không đổi cỡ để chữ không rung.
 */
function placeNode(bubble: HTMLElement | null, label: HTMLElement | null, angle: number, width: number, height: number) {
  const p = orbitPoint(angle);
  const move = `translate3d(${((p.x / W) * width).toFixed(2)}px, ${((p.y / H) * height).toFixed(2)}px, 0)`;
  const behind = p.depth <= 0;
  if (bubble) {
    bubble.style.transform = move;
    bubble.style.setProperty('--depth-scale', (0.78 + ((p.depth + 1) / 2) * 0.26).toFixed(3));
    const zIndex = p.depth > 0 ? '5' : '2';
    if (bubble.style.zIndex !== zIndex) bubble.style.zIndex = zIndex;
    if (bubble.classList.contains('is-behind') !== behind) bubble.classList.toggle('is-behind', behind);
  }
  if (label) {
    label.style.transform = move;
    if (label.classList.contains('is-behind') !== behind) label.classList.toggle('is-behind', behind);
  }
}

/** Nửa sau (phía trên) và nửa trước (phía dưới) của vành quỹ đạo */
const ARC_BACK = `M ${-ORBIT.rx} 0 A ${ORBIT.rx} ${ORBIT.ry} 0 0 1 ${ORBIT.rx} 0`;
const ARC_FRONT = `M ${ORBIT.rx} 0 A ${ORBIT.rx} ${ORBIT.ry} 0 0 1 ${-ORBIT.rx} 0`;
const ORBIT_TRANSFORM = `translate(${CX} ${ORBIT.cy}) rotate(${ORBIT.tilt})`;

/**
 * Sơ đồ 360° phong cách hiện đại (khối phẳng, đường kẻ mảnh): hình người biểu tượng cho bản thân đứng trên bệ ở giữa,
 * các nhóm người đánh giá quay quanh trên vành quỹ đạo nghiêng (vòng sau đi sau lưng, vòng trước vắt qua người).
 * Rê chuột thì quay chậm lại, rê vào một nhóm thì nhóm đó nổi lên. Tắt thì chuyển xám và dừng.
 */
export const Rater360: React.FC<Rater360Props> = ({
  nodes,
  centerLabel = 'Bạn',
  centerSub,
  active = true,
  compact = false,
  paused = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const { ref, inView, seen } = useInView<HTMLElement>(0.2);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ width: W, height: H });
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const angleRef = useRef(0);
  const speedRef = useRef(1);
  const slowRef = useRef(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const count = Math.max(nodes.length, 1);
  /* Góc xuất phát: các nhóm cách đều, lệch nửa bước để không nhóm nào đứng đúng sau lưng */
  const baseAngle = (i: number) => (Math.PI * 2 * i) / count + Math.PI / count + Math.PI / 2;
  const placeAll = () => {
    const { width, height } = sizeRef.current;
    nodes.forEach((_, i) => placeNode(nodeRefs.current[i], labelRefs.current[i], baseAngle(i) + angleRef.current, width, height));
  };

  /* Đo khung cảnh một lần rồi chỉ đo lại khi đổi kích thước, không đọc kích thước trong vòng vẽ */
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      sizeRef.current = { width: rect.width || W, height: rect.height || H };
      placeAll();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  useEffect(() => {
    slowRef.current = hoverKey !== null;
  }, [hoverKey]);

  useEffect(() => {
    if (paused || !inView) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 64) / 1000 : 0;
      last = now;
      const target = !active ? 0 : slowRef.current ? 0.12 : 1;
      speedRef.current += (target - speedRef.current) * 0.06;
      angleRef.current += ((Math.PI * 2) / TURN_SECONDS) * dt * speedRef.current;
      placeAll();
      /* Đã tắt và quay chậm gần như dừng thì nghỉ vòng vẽ */
      if (!active && speedRef.current < 0.002) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, inView, active, nodes.length]);

  const g = (name: string) => `${uid}-${name}`;

  return (
    <figure
      ref={ref}
      className={`rater360 ${seen ? 'is-visible' : ''} ${active ? '' : 'is-off'} ${compact ? 'is-compact' : ''} ${className}`}
    >
      <div className="rater360-stage" ref={stageRef}>
        {/* Lớp sau: quầng sàn và nửa sau vành quỹ đạo */}
        <svg className="rater360-layer rater360-layer-back" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <radialGradient id={g('floor')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" className="rater360-floor-in" />
              <stop offset="100%" className="rater360-floor-out" />
            </radialGradient>
          </defs>
          <ellipse cx={CX} cy={230} rx={150} ry={42} fill={`url(#${g('floor')})`} />
          <g transform={ORBIT_TRANSFORM}>
            <path d={ARC_BACK} className="rater360-orbit-casing" />
            <path d={ARC_BACK} className="rater360-orbit" />
          </g>
        </svg>

        {/* Hình người biểu tượng cho bản thân, đứng trên bệ */}
        <svg className="rater360-layer rater360-layer-figure" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <linearGradient id={g('body')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" className="rater360-self-hi" />
              <stop offset="55%" className="rater360-self-mid" />
              <stop offset="100%" className="rater360-self-lo" />
            </linearGradient>
            <radialGradient id={g('head')} cx="36%" cy="30%" r="75%">
              <stop offset="0%" className="rater360-self-hi" />
              <stop offset="55%" className="rater360-self-mid" />
              <stop offset="100%" className="rater360-self-lo" />
            </radialGradient>
            <linearGradient id={g('base')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" className="rater360-base-hi" />
              <stop offset="100%" className="rater360-base-lo" />
            </linearGradient>
          </defs>

          <g className="rater360-figure">
            {/* Bệ đứng hình trụ dẹt */}
            <path d="M 132 214 L 132 228 A 68 18 0 0 0 268 228 L 268 214 Z" fill={`url(#${g('base')})`} className="rater360-ink" />
            <ellipse cx={CX} cy={214} rx={68} ry={18} className="rater360-base-top rater360-ink" />

            {/* Bóng đổ dưới chân */}
            <ellipse cx={CX} cy={212} rx={44} ry={10} className="rater360-shadow" />

            {/* Thân: vai tròn, đáy bo theo phối cảnh */}
            <path
              d="M 152 206 C 152 168 170 144 200 144 C 230 144 248 168 248 206 A 48 12 0 0 1 152 206 Z"
              fill={`url(#${g('body')})`}
              className="rater360-ink"
            />
            <path d="M 166 186 C 166 166 178 154 194 152" className="rater360-shine" />

            {/* Đầu cầu với vệt sáng */}
            <circle cx={CX} cy={110} r={30} fill={`url(#${g('head')})`} className="rater360-ink" />
            <ellipse cx={189} cy={98} rx={9} ry={6} className="rater360-gloss" transform="rotate(-28 189 98)" />
          </g>
        </svg>

        {/* Lớp trước: nửa trước vành quỹ đạo vắt qua người */}
        <svg className="rater360-layer rater360-layer-front" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <g transform={ORBIT_TRANSFORM}>
            <path d={ARC_FRONT} className="rater360-orbit-casing" />
            <path d={ARC_FRONT} className="rater360-orbit" />
          </g>
        </svg>

        {nodes.map((node, i) => {
          const Icon = node.Icon;
          return (
            <span
              key={node.key}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              className={`rater360-node rater360-tone-${TONES[i % TONES.length]} ${hoverKey === node.key ? 'is-hover' : ''}`}
              style={{ '--i': i } as React.CSSProperties}
              onPointerEnter={() => setHoverKey(node.key)}
              onPointerLeave={() => setHoverKey((k) => (k === node.key ? null : k))}
            >
              <span className="rater360-node-pop">
                <span className="rater360-bubble" aria-hidden="true">
                  <Icon strokeWidth={2.2} />
                </span>
              </span>
            </span>
          );
        })}

        {!compact &&
          nodes.map((node, i) => (
            <span
              key={`label-${node.key}`}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              className={`rater360-label ${hoverKey === node.key ? 'is-hover' : ''}`}
              style={{ '--i': i } as React.CSSProperties}
              aria-hidden="true"
            >
              <span className="rater360-chip">
                <span className="rater360-chip-label">{node.label}</span>
                {(node.meta || node.value) && (
                  <span className="rater360-chip-meta">{[node.value, node.meta].filter(Boolean).join(' · ')}</span>
                )}
              </span>
            </span>
          ))}

        {!compact && (
          <span className="rater360-center">
            <span className="rater360-center-label">{centerLabel}</span>
            {centerSub && <span className="rater360-center-sub">{centerSub}</span>}
          </span>
        )}
      </div>

      {!compact && (
        <figcaption className="sr-only">
          {centerLabel} ở giữa, xung quanh là {nodes.map((n) => n.label).join(', ')}
        </figcaption>
      )}
    </figure>
  );
};
