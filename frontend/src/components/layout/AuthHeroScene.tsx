import React from 'react';
import { BookOpen, Compass, GraduationCap, MapPin, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { useLowPower } from '../../hooks/useLowPower';
import './AuthHeroScene.css';

type DoodleShape = 'wave' | 'ring' | 'plus' | 'triangle';

/** Nét vẽ tay cùng họa tiết với nền trang: sóng, vòng tròn, dấu cộng, tam giác */
const DOODLE_PATHS: Record<DoodleShape, { viewBox: string; d: string }> = {
  wave: { viewBox: '0 0 160 56', d: 'M6 28q20-28 38 0t38 0t38 0t38 0' },
  ring: { viewBox: '0 0 56 56', d: 'M28 6a22 22 0 1 0 0 44a22 22 0 1 0 0-44z' },
  plus: { viewBox: '0 0 56 56', d: 'M28 8v40M8 28h40' },
  triangle: { viewBox: '0 0 56 56', d: 'M28 6l24 42H4z' },
};

const DOODLES: DoodleShape[] = ['wave', 'ring', 'plus', 'triangle', 'plus', 'wave', 'ring', 'triangle', 'plus', 'ring'];

const CHIPS: { name: string; Icon: LucideIcon }[] = [
  { name: 'cap', Icon: GraduationCap },
  { name: 'compass', Icon: Compass },
  { name: 'spark', Icon: Sparkles },
  { name: 'place', Icon: MapPin },
  { name: 'target', Icon: Target },
  { name: 'book', Icon: BookOpen },
];

/** Lộ trình chấm chấm chạy dưới đáy rồi lên mép phải tới ghim định vị, tránh vùng chữ ở giữa; đúng ý tưởng "vẽ bản đồ" của logo */
const ROUTE_PATH = 'M20 840C60 760 140 740 200 730C270 720 330 780 400 740C470 700 560 680 540 600C520 520 560 470 520 400C490 330 540 270 500 190';
const ROUTE_NODES = [
  { x: 200, y: 730 },
  { x: 400, y: 740 },
  { x: 540, y: 600 },
  { x: 520, y: 400 },
];
const PIN_PATH = 'M0-34c-12 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34c0-11-8-20-20-20z';

export const AuthHeroScene: React.FC = () => {
  const lowPower = useLowPower();

  return (
    <div className={`auth-scene ${lowPower ? 'is-calm' : ''}`} aria-hidden="true">
      <div className="auth-scene-layer auth-scene-blobs">
        <span className="auth-blob auth-blob-a" />
        <span className="auth-blob auth-blob-b" />
        <span className="auth-blob auth-blob-c" />
      </div>

      <svg className="auth-scene-layer auth-route" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
        <path className="auth-route-line" d={ROUTE_PATH} />
        {ROUTE_NODES.map((node, index) => (
          <g key={index} className={`auth-route-node auth-route-node-${index + 1}`}>
            <circle className="auth-route-pulse" cx={node.x} cy={node.y} r={14} />
            <circle className="auth-route-dot" cx={node.x} cy={node.y} r={7} />
          </g>
        ))}
        <g transform="translate(500 190)">
          <g className="auth-route-pin">
            <path className="auth-route-pin-body" d={PIN_PATH} />
            <circle className="auth-route-pin-hole" cx={0} cy={-14} r={7} />
          </g>
        </g>
      </svg>

      <div className="auth-scene-layer auth-doodles">
        {DOODLES.map((shape, index) => (
          <svg
            key={index}
            className={`auth-doodle auth-doodle-${shape} auth-doodle-${index + 1}`}
            viewBox={DOODLE_PATHS[shape].viewBox}
          >
            <path d={DOODLE_PATHS[shape].d} />
          </svg>
        ))}
      </div>

      <div className="auth-scene-layer auth-chips">
        {CHIPS.map(({ name, Icon }) => (
          <span key={name} className={`auth-chip auth-chip-${name}`}>
            <span className="auth-chip-body">
              <Icon size={22} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};
