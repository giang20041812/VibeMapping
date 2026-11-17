import React from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from '../common';
import './BrandLink.css';

export interface BrandLinkProps {
  onClick?: () => void;
  /** Ẩn dòng chữ nhỏ cạnh tên (chỗ hẹp như chân trang) */
  compact?: boolean;
  className?: string;
}

/** Logo và tên sản phẩm dẫn về trang giới thiệu: dùng chung ở thanh trên cùng, trang đăng nhập và chân trang. */
export const BrandLink: React.FC<BrandLinkProps> = ({ onClick, compact = false, className = '' }) => (
  <Link to="/" className={`brand-link ${className}`} aria-label="Vibe Mapping" onClick={onClick}>
    <span className="brand-link-mark">
      <LogoMark />
    </span>
    <span className="brand-link-text" aria-hidden="true">
      <span className="brand-link-wordmark">
        <span className="brand-link-vibe">Vibe</span>
        <span className="brand-link-mapping">Mapping</span>
      </span>
      {!compact && <span className="brand-link-tag">Định hướng 360°</span>}
    </span>
  </Link>
);
