import React, { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { LogoMark } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import { navItemsFor } from './navigation';
import { TopActions } from './TopActions';
import './Navbar.css';

export interface NavbarProps {
  /** Điện thoại: danh sách mục xổ xuống dưới thanh khi true */
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Thanh điều hướng ngang dính ở đầu trang: logo bên trái, các mục ở giữa, thông báo và avatar bên phải.
 * Điện thoại: các mục gộp vào nút menu và xổ xuống dưới thanh.
 */
export const Navbar: React.FC<NavbarProps> = ({ open, onToggle, onClose }) => {
  const { profile } = useAuth();
  const items = navItemsFor(profile?.role);

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
      {open && <div className="navbar-scrim" onClick={onClose} aria-hidden="true" />}

      <header className={`navbar ${open ? 'is-open' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand" aria-label="Vibe Mapping" onClick={onClose}>
            <span className="navbar-brand-mark">
              <LogoMark />
            </span>
            <span className="navbar-brand-text" aria-hidden="true">
              <span className="navbar-brand-vibe">ibe</span>
              <span className="navbar-brand-mapping">Mapping</span>
            </span>
          </Link>

          <nav id="app-navbar-links" className="navbar-links" aria-label="Điều hướng chính">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
                  onClick={onClose}
                >
                  <span className="navbar-link-icon">
                    <Icon size={20} />
                  </span>
                  <span className="navbar-link-label">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="navbar-end">
            <TopActions />
            <button
              type="button"
              className="navbar-toggle"
              aria-label={open ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={open}
              aria-controls="app-navbar-links"
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
