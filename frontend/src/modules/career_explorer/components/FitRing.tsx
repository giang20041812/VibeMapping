import React, { useId } from 'react';

/** Vòng phần trăm phù hợp tô gradient */
export const FitRing: React.FC<{ percent: number; size?: number; label?: string }> = ({ percent, size = 96, label }) => {
  const id = `fit-ring-${useId().replace(/:/g, '')}`;
  const stroke = Math.max(8, size / 9);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div className="fit-ring" style={{ width: size, height: size, fontSize: size * 0.2 }} role="img" aria-label={label ?? `Phù hợp ${Math.round(value)}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="fit-ring-stop-a" />
            <stop offset="1" className="fit-ring-stop-b" />
          </linearGradient>
        </defs>
        <circle className="fit-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="fit-ring-bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          stroke={`url(#${id})`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="fit-ring-value">{Math.round(value)}<small>%</small></span>
    </div>
  );
};
