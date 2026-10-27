import React from 'react';
import './Logo.css';

export interface LogoProps {
  variant?: 'mark' | 'full' | 'stacked';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  tone?: 'default' | 'inverse';
  animated?: boolean;
  className?: string;
}

/** Ghim định vị kéo dài, chữ V nằm đúng trên hai cạnh đuôi ghim (đỉnh V là mũi ghim); bản đồ gập là chữ M, mũ cử nhân và nét mặt tươi cho Vibe + Mapping. */
export const LogoMark: React.FC<{ animated?: boolean }> = ({ animated = false }) => (
  <svg
    className={`logo-svg ${animated ? 'is-animated' : ''}`}
    viewBox="0 0 240 240"
    role="img"
    aria-label="Vibe Mapping"
  >
    <g className="logo-map">
      <path className="logo-map-light logo-map-panel logo-map-panel-1" d="M24 134 L72 104 L72 188 L24 218 Z" />
      <path className="logo-map-dark logo-map-panel logo-map-panel-2" d="M72 104 L120 134 L120 218 L72 188 Z" />
      <path className="logo-map-light logo-map-panel logo-map-panel-3" d="M120 134 L168 104 L168 188 L120 218 Z" />
      <path className="logo-map-dark logo-map-panel logo-map-panel-4" d="M168 104 L216 134 L216 218 L168 188 Z" />
      <path className="logo-route" d="M36 184 Q50 158 62 168" />
      <path className="logo-route" d="M180 156 Q196 182 208 164" />
    </g>

    <g className="logo-character">
      <path className="logo-pin" d="M120 202 L78.6 116 A46 46 0 1 1 161.4 116 Z" />
      <path className="logo-pin-v-edge" d="M86.3 132 L120 202 L153.7 132" />
      <path className="logo-pin-v" d="M86.3 132 L120 202 L153.7 132" />

      <g className="logo-face">
        <g className="logo-eyes">
          <path className="logo-eye" d="M98 101 Q105 91 112 101" />
          <path className="logo-eye" d="M128 101 Q135 91 142 101" />
        </g>
        <path className="logo-mouth" d="M108 111 Q120 131 132 111 Z" />
        <circle className="logo-cheek" cx="94" cy="113" r="5.5" />
        <circle className="logo-cheek" cx="146" cy="113" r="5.5" />
      </g>

      <g className="logo-cap">
        <path className="logo-cap-base" d="M92 56 L92 69 Q120 83 148 69 L148 56 Z" />
        <path className="logo-cap-board" d="M46 50 L120 26 L194 50 L120 74 Z" />
        <path className="logo-cap-shine" d="M58 50 L120 30 L120 50 Z" />
        <circle className="logo-gold" cx="120" cy="50" r="4.5" />
        <g className="logo-tassel">
          <path className="logo-cord" d="M120 50 Q172 54 182 64 L182 92" />
          <rect className="logo-tassel-body" x="176" y="90" width="12" height="22" rx="5" />
          <path className="logo-fringe" d="M179 118 L179 126 M182 118 L182 128 M185 118 L185 126" />
        </g>
      </g>
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
