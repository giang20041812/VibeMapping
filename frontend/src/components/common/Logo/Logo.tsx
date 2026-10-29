import React from 'react';
import { LOGO_CAP, LOGO_DOTS, LOGO_PIN } from './logoPaths';
import './Logo.css';

export interface LogoProps {
  variant?: 'mark' | 'full' | 'stacked';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  tone?: 'default' | 'inverse';
  animated?: boolean;
  className?: string;
}

/** Hình tròn navy: mũ cử nhân, dây mũ nối các chấm lộ trình tới ghim định vị. */
export const LogoMark: React.FC<{ animated?: boolean }> = ({ animated = false }) => (
  <svg
    className={`logo-svg ${animated ? 'is-animated' : ''}`}
    viewBox="0 0 1600 1600"
    role="img"
    aria-label="Vibe Mapping"
  >
    <circle className="logo-disc" cx="800" cy="800" r="800" />
    <g transform="translate(800 800) scale(1.9)">
      <path className="logo-cap" d={LOGO_CAP} />
      {LOGO_DOTS.map((d, i) => (
        <path key={i} className="logo-dot" d={d} />
      ))}
      <path className="logo-pin" fillRule="evenodd" d={LOGO_PIN} />
    </g>
  </svg>
);

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  size = 'md',
  tone = 'default',
  animated = false,
  className = '',
}) => (
  <span className={`app-logo logo-${variant} logo-size-${size} logo-tone-${tone} ${className}`}>
    <span className="logo-mark-box">
      <LogoMark animated={animated} />
    </span>
    {variant !== 'mark' && (
      <span className="logo-wordmark" aria-hidden="true">
        <span className="logo-wordmark-vibe">Vibe</span>
        <span className="logo-wordmark-mapping">Mapping</span>
      </span>
    )}
  </span>
);
