import React from 'react';
import type { LucideIcon } from 'lucide-react';
import './StatSticker.css';

export type StatTone = 'violet' | 'cyan' | 'magenta' | 'gold' | 'teal' | 'sky';
export type StickerPlace = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Nhãn dán nổi trên hình minh họa: một con số và nhãn ngắn, hơi nghiêng, bồng bềnh nhẹ */
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
