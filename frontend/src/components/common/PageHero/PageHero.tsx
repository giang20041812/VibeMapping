import React from 'react';
import type { StickerTone } from '../StickerCard/StickerCard';
import '../StickerCard/StickerCard.css';
import './PageHero.css';

export interface PageHeroProps {
  title: string;
  icon: React.ReactNode;
  tone?: StickerTone;
  /** Số kết quả hiện ở nhãn dán cạnh tiêu đề; bỏ trống khi chưa có */
  count?: number | null;
  countLabel?: string;
  /** Nút hoặc liên kết đặt bên phải tiêu đề */
  actions?: React.ReactNode;
}

/** Tiêu đề trang khám phá: ô biểu tượng kiểu hình dán, tên trang lớn, nhãn đếm kết quả */
export const PageHero: React.FC<PageHeroProps> = ({ title, icon, tone = 'blue', count, countLabel, actions }) => (
  <header className={`page-hero sticker-tone-${tone}`}>
    <span className="page-hero-icon" aria-hidden="true">{icon}</span>
    <div className="page-hero-text">
      <h1 className="page-hero-title">{title}</h1>
      {count !== undefined && count !== null && (
        <span className="page-hero-count">
          <b>{count.toLocaleString('vi-VN')}</b> {countLabel}
        </span>
      )}
    </div>
    {actions && <div className="page-hero-actions">{actions}</div>}
  </header>
);
