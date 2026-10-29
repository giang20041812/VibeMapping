import React, { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { LogoMark } from '../common';
import { TOPBAR_ITEMS } from './navigation';
import { TopActions } from './TopActions';
import './Topbar.css';

export interface TopbarProps {
  /** Điện thoại: các mục xổ xuống dưới thanh khi true */
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Thanh điều hướng ngang dính ở đầu trang giới thiệu, khám phá trường và khi khách làm bài test:
 * logo bên trái, các mục ở giữa, đăng nhập / đăng ký hoặc thông báo và avatar bên phải.
 * Điện thoại: các mục gộp vào nút menu và xổ xuống dưới thanh.
 */
export const Topbar: React.FC<TopbarProps> = ({ open, onToggle, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="topbar-scrim" onClick={onClose} aria-hidden="true" />}

      <header className={`topbar ${open ? 'is-open' : ''}`}>
        <div className="topbar-inner">
          <Link to="/" className="topbar-brand" aria-label="Vibe Mapping" onClick={onClose}>
            <span className="topbar-brand-mark">
              <LogoMark />
            </span>
            <span className="topbar-brand-text" aria-hidden="true">
              <span className="topbar-brand-vibe">Vibe</span>
              <span className="topbar-brand-mapping">Mapping</span>
            </span>
          </Link>

          <nav id="topbar-links" className="topbar-links" aria-label="Điều hướng chính">
            {TOPBAR_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `topbar-link ${isActive ? 'is-active' : ''}`}
                onClick={onClose}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="topbar-end">
            <TopActions inline />
            <button
              type="button"
              className="topbar-toggle"
              aria-label={open ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={open}
              aria-controls="topbar-links"
              onClick={onToggle}
            >
              {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
