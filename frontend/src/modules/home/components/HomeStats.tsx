import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../../../hooks/useCountUp';
import { useInView } from '../../../hooks/useInView';
import './HomeStats.css';

export type StatTone = 'violet' | 'cyan' | 'magenta' | 'gold' | 'teal' | 'sky';

/** Số đếm dần khi ô hiện ra; giá trị chữ (ví dụ "6–18′") thì hiện nguyên */
const StatValue: React.FC<{ value: number | string; suffix?: string; run: boolean }> = ({ value, suffix = '', run }) => {
  const isNumber = typeof value === 'number';
  const counted = useCountUp(isNumber && run ? value : null, 1100);
  if (!isNumber) return <>{value}</>;
  const shown = run ? Math.round(counted ?? 0) : 0;
  return (
    <>
      {shown.toLocaleString('vi-VN')}
      {suffix}
    </>
  );
};

export interface StatItem {
  key: string;
  value: number | string;
  suffix?: string;
  label: string;
  icon?: LucideIcon;
  tone: StatTone;
}

/** Hàng ô số liệu kiểu hình dán: số lớn tô gradient, nhãn ngắn bên dưới */
export const StatTiles: React.FC<{ items: StatItem[]; size?: 'md' | 'lg'; className?: string }> = ({ items, size = 'md', className = '' }) => {
  const { ref, seen } = useInView<HTMLUListElement>(0.3);
  return (
    <ul ref={ref} className={`stat-tiles stat-tiles-${size} ${seen ? 'is-visible' : ''} ${className}`}>
      {items.map(({ key, value, suffix, label, icon: Icon, tone }) => (
        <li key={key} className={`stat-tile stat-tone-${tone}`}>
          {Icon && (
            <span className="stat-tile-icon" aria-hidden="true">
              <Icon size={size === 'lg' ? 22 : 18} strokeWidth={2.4} />
            </span>
          )}
          <span className="stat-tile-value">
            <StatValue value={value} suffix={suffix} run={seen} />
          </span>
          <span className="stat-tile-label">{label}</span>
        </li>
      ))}
    </ul>
  );
};

/** Hàng số liệu chỉ có chữ trên nền, các cột ngăn bằng đường kẻ nhạt */
export const StatInline: React.FC<{ items: StatItem[] }> = ({ items }) => {
  const { ref, seen } = useInView<HTMLUListElement>(0.3);
  return (
    <ul ref={ref} className="stat-inline">
      {items.map(({ key, value, suffix, label, icon: Icon, tone }) => (
        <li key={key} className={`stat-inline-item stat-tone-${tone}`}>
          {Icon && (
            <span className="stat-inline-icon" aria-hidden="true">
              <Icon size={26} strokeWidth={2.2} />
            </span>
          )}
          <span className="stat-inline-text">
            <span className="stat-inline-value">
              <StatValue value={value} suffix={suffix} run={seen} />
            </span>
            <span className="stat-inline-label">{label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};

export type StickerPlace = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Nhãn dán nổi trên hình minh họa: một con số và nhãn ngắn, bồng bềnh nhẹ */
export const StatSticker: React.FC<{ value: string; label: string; icon?: LucideIcon; tone: StatTone; place: StickerPlace }> = ({
  value,
  label,
  icon: Icon,
  tone,
  place,
}) => (
  <span className={`stat-sticker stat-tone-${tone} stat-sticker-${place}`}>
    {Icon && (
      <span className="stat-sticker-icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2.6} />
      </span>
    )}
    <span className="stat-sticker-text">
      <strong className="stat-sticker-value">{value}</strong>
      <span className="stat-sticker-label">{label}</span>
    </span>
  </span>
);
