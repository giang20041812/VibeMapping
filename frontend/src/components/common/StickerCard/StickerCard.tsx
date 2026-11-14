import React from 'react';
import './StickerCard.css';

export type StickerTone = 'blue' | 'violet' | 'magenta' | 'gold' | 'teal' | 'coral';

/** Xoay vòng các sắc để lưới thẻ không đơn điệu */
export const STICKER_TONES: StickerTone[] = ['blue', 'magenta', 'gold', 'teal', 'violet', 'coral'];
export const stickerToneAt = (index: number): StickerTone => STICKER_TONES[index % STICKER_TONES.length];

/** Lưới thẻ tự lấp đầy chiều ngang */
export const StickerGrid: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label }) => (
  <ul className="sticker-grid" aria-label={label}>
    {children}
  </ul>
);

export interface StickerCardProps {
  tone?: StickerTone;
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Góc phải đầu thẻ (nhãn, liên kết ngoài) */
  corner?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Thẻ kiểu hình dán: viền mực dày, bóng đặc lệch xuống, dải màu đầu thẻ, nhô lên khi rê chuột */
export const StickerCard: React.FC<StickerCardProps> = ({ tone = 'blue', icon, title, corner, children, footer }) => (
  <li className={`sticker-card sticker-tone-${tone}`}>
    <div className="sticker-card-head">
      {icon && (
        <span className="sticker-card-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="sticker-card-title">{title}</div>
      {corner && <div className="sticker-card-corner">{corner}</div>}
    </div>
    {children && <div className="sticker-card-body">{children}</div>}
    {footer && <div className="sticker-card-footer">{footer}</div>}
  </li>
);

/** Thẻ giữ chỗ khi đang tải, cùng khung với thẻ thật */
export const StickerCardSkeleton: React.FC = () => (
  <li className="sticker-card is-skeleton" aria-hidden="true">
    <div className="sticker-card-head">
      <span className="sticker-card-icon" />
      <span className="sticker-skeleton-line" />
    </div>
    <div className="sticker-card-body">
      <span className="sticker-skeleton-chip" />
      <span className="sticker-skeleton-chip" />
    </div>
  </li>
);

/** Ô thông tin nhỏ trong thân thẻ: biểu tượng + chữ */
export const StickerFact: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; strong?: boolean }> = ({ icon, children, strong }) => (
  <span className={`sticker-fact${strong ? ' is-strong' : ''}`}>
    {icon && (
      <span className="sticker-fact-icon" aria-hidden="true">
        {icon}
      </span>
    )}
    {children}
  </span>
);
