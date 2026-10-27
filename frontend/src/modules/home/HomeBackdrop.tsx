import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  Compass,
  FlaskConical,
  GraduationCap,
  Handshake,
  Library,
  Lightbulb,
  Microscope,
  PenTool,
  Rocket,
  Sigma,
  Target,
  Telescope,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useLowPower } from '../../hooks/useLowPower';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './HomeBackdrop.css';

type Depth = 'far' | 'mid' | 'near';

/* Thứ tự khớp với quy tắc :nth-child trong HomeBackdrop.css (vị trí, thời gian trôi) */
const ICONS: { icon: LucideIcon; depth: Depth }[] = [
  { icon: GraduationCap, depth: 'near' },
  { icon: BookOpen, depth: 'mid' },
  { icon: Briefcase, depth: 'mid' },
  { icon: Lightbulb, depth: 'far' },
  { icon: Compass, depth: 'near' },
  { icon: Rocket, depth: 'mid' },
  { icon: Target, depth: 'far' },
  { icon: Microscope, depth: 'mid' },
  { icon: Calculator, depth: 'far' },
  { icon: PenTool, depth: 'mid' },
  { icon: Award, depth: 'far' },
  { icon: Brain, depth: 'near' },
  { icon: FlaskConical, depth: 'far' },
  { icon: Telescope, depth: 'mid' },
  { icon: Handshake, depth: 'far' },
  { icon: TrendingUp, depth: 'mid' },
  { icon: Library, depth: 'far' },
  { icon: Sigma, depth: 'far' },
];

const GLYPHS: { text: string; depth: Depth }[] = [
  { text: 'π', depth: 'mid' },
  { text: '∑', depth: 'far' },
  { text: 'E=mc²', depth: 'near' },
  { text: '</>', depth: 'mid' },
];

const SPARK_COUNT = 18;

/**
 * Nền chuyển động của trang chủ: cực quang, tia sáng, lưới phối cảnh, biểu tượng học thuật –
 * nghề nghiệp mờ ở nhiều lớp chiều sâu. Gắn vào đầu `body` để không bị ảnh hưởng bởi `transform`
 * của khung trang và luôn nằm dưới nội dung.
 */
export const HomeBackdrop: React.FC = () => {
  const reduced = useReducedMotion();
  const lowPower = useLowPower();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = document.createElement('div');
    document.body.prepend(element);
    setHost(element);
    return () => {
      element.remove();
      setHost(null);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced || lowPower || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let frame = 0;
    let nx = 0;
    let ny = 0;
    const onMove = (event: PointerEvent) => {
      nx = (event.clientX / window.innerWidth) * 2 - 1;
      ny = (event.clientY / window.innerHeight) * 2 - 1;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--px', nx.toFixed(3));
        root.style.setProperty('--py', ny.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced, lowPower, host]);

  if (!host) return null;

  return createPortal(
    <div ref={rootRef} className={`home-backdrop ${lowPower ? 'is-lite' : ''}`} aria-hidden="true">
      <div className="bd-aurora bd-aurora-1" />
      <div className="bd-aurora bd-aurora-2" />
      <div className="bd-aurora bd-aurora-3" />
      <div className="bd-aurora bd-aurora-4" />
      <div className="bd-aurora bd-aurora-5" />

      <div className="bd-grid" />

      <div className="bd-beams">
        <span className="bd-beam" />
        <span className="bd-beam" />
        <span className="bd-beam" />
      </div>

      <svg className="bd-atom" viewBox="-100 -100 200 200">
        <g className="bd-atom-orbits">
          <ellipse rx="92" ry="34" />
          <ellipse rx="92" ry="34" transform="rotate(60)" />
          <ellipse rx="92" ry="34" transform="rotate(120)" />
          <circle cx="92" cy="0" r="5" />
          <circle cx="-46" cy="29" r="5" transform="rotate(60)" />
          <circle cx="-46" cy="-29" r="5" transform="rotate(120)" />
        </g>
        <circle className="bd-atom-core" r="10" />
      </svg>

      <svg className="bd-path" viewBox="0 0 260 170">
        <polyline className="bd-path-line" points="10,160 60,160 60,120 110,120 110,82 160,82 160,46 210,46 210,12 252,12" />
        <circle className="bd-path-node" cx="60" cy="160" r="6" />
        <circle className="bd-path-node" cx="110" cy="120" r="6" />
        <circle className="bd-path-node" cx="160" cy="82" r="6" />
        <circle className="bd-path-node" cx="210" cy="46" r="6" />
        <circle className="bd-path-node bd-path-goal" cx="252" cy="12" r="8" />
      </svg>

      <div className="bd-items">
        {ICONS.map(({ icon: Icon, depth }, i) => (
          <span key={`icon-${i}`} className={`bd-item bd-${depth}`}>
            <span className="bd-item-body">
              <Icon strokeWidth={1.5} />
            </span>
          </span>
        ))}
        {GLYPHS.map(({ text, depth }) => (
          <span key={text} className={`bd-item bd-glyph bd-${depth}`}>
            <span className="bd-item-body">{text}</span>
          </span>
        ))}
      </div>

      <div className="bd-sparks">
        {Array.from({ length: SPARK_COUNT }, (_, i) => (
          <span key={i} className="bd-spark" />
        ))}
      </div>
    </div>,
    host,
  );
};
