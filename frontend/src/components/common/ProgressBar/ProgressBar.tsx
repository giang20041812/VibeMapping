import React from 'react';
import './ProgressBar.css';

export interface ProgressBarProps {
  /** 0–100; null là chưa có dữ liệu */
  value: number | null;
  label: string;
  tone?: 'primary' | 'secondary' | 'accent';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, tone = 'primary', className = '' }) => {
  const percent = value === null ? 0 : Math.max(0, Math.min(value, 100));
  return (
    <div
      className={`app-progress progress-${tone} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(percent)}
    >
      <span className="progress-fill" style={{ '--progress': percent / 100 } as React.CSSProperties} />
    </div>
  );
};
