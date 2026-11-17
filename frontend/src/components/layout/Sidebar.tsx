import React, { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { LogoMark } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import { navItemsFor } from './navigation';
import './Sidebar.css';

export interface SidebarProps {
  /** Điện thoại: thanh trượt ra từ mép trái khi true */
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Hồ sơ chưa khai báo xong: vẫn hiện các mục nhưng không bấm được */
  locked?: boolean;
}

/**
 * Thanh điều hướng cố định bên trái: logo trên cùng, các mục xếp dọc thành hàng ngăn bằng đường kẻ.
 * Điện thoại: ẩn hẳn, mở bằng nút ở góc trên bên trái.
 */
export const Sidebar: React.FC<SidebarProps> = ({ open, onToggle, onClose, locked = false }) => {
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

  const brand = (
    <>
      <span className="sidebar-brand-mark logo-on-dark">
        <LogoMark />
      </span>
      <span className="sidebar-brand-text" aria-hidden="true">
        <span className="sidebar-brand-vibe">Vibe</span>
        <span className="sidebar-brand-mapping">Mapping</span>
      </span>
    </>
  );

  return (
    <>
      <button type="button" className="sidebar-toggle" aria-label="Mở menu" aria-expanded={open} aria-controls="app-sidebar" onClick={onToggle}>
        <Menu size={22} aria-hidden="true" />
      </button>

      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}

      <aside id="app-sidebar" className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Điều hướng chính">
        <div className="sidebar-top">
          {locked ? (
            <span className="sidebar-brand is-disabled" aria-label="Vibe Mapping">
              {brand}
            </span>
          ) : (
            <Link to="/" className="sidebar-brand" aria-label="Vibe Mapping" onClick={onClose}>
              {brand}
            </Link>
          )}
          <button type="button" className="sidebar-close" aria-label="Đóng menu" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className={`sidebar-nav ${locked ? 'is-locked' : 'hover-sweep-group'}`} aria-disabled={locked || undefined}>
          {items.map((item) => {
            const Icon = item.icon;
            if (locked) {
              return (
                <span key={item.to} className="sidebar-link is-disabled" aria-disabled="true">
                  <span className="sidebar-link-icon">
                    <Icon size={20} />
                  </span>
                  <span className="sidebar-link-label">{item.label}</span>
                </span>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link hover-sweep ${isActive ? 'is-active' : ''}`}
                onClick={onClose}
              >
                <span className="sidebar-link-icon">
                  <Icon size={20} />
                </span>
                <span className="sidebar-link-label">{item.label}</span>
                <ArrowUpRight size={16} className="sidebar-link-arrow hover-sweep-arrow" aria-hidden="true" />
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
