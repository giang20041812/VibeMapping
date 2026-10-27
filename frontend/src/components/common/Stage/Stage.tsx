import React from 'react';
import './Stage.css';

export interface StageProps {
  children: React.ReactNode;
  className?: string;
}

/** Khung nền tối có viền dải màu, dùng cho các hình minh họa phát sáng (biểu đồ, quả địa cầu) */
export const Stage: React.FC<StageProps> = ({ children, className = '' }) => (
  <div className={`stage-frame ${className}`}>
    <div className="stage">{children}</div>
  </div>
);
