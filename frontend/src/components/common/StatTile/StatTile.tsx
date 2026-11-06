import React from 'react';
import type { StickerTone } from '../StickerCard/StickerCard';
import '../StickerCard/StickerCard.css';
import './StatTile.css';

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: StickerTone;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/** Ô số lớn kiểu hình dán: nhãn, giá trị, đơn vị, phần phụ (thanh tiến độ, ghi chú) */
export const StatTile: React.FC<StatTileProps> = ({ label, value, unit, tone = 'blue', icon, children }) => (
  <div className={`stat-tile sticker-tone-${tone}`}>
    <div className="stat-tile-label">
      {icon && (
        <span className="stat-tile-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {label}
    </div>
    <div className="stat-tile-value">
      <b>{value}</b>
      {unit && <span>{unit}</span>}
    </div>
    {children && <div className="stat-tile-extra">{children}</div>}
  </div>
);
