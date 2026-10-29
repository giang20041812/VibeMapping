import React, { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { LogoMark } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import { navItemsFor } from './navigation';
import './Sidebar.css';

export interface SidebarProps {
  /** Điện thoại: thanh trượt ra từ mép trái khi true */
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Thanh điều hướng cố định bên trái: logo trên cùng, các mục xếp dọc.
 * Điện thoại: ẩn hẳn, mở bằng nút ở góc trên bên trái.
 */
export const Sidebar: React.FC<SidebarProps> = ({ open, onToggle, onClose }) => {
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
      <button type="button" className="sidebar-toggle" aria-label="Mở menu" aria-expanded={open} aria-controls="app-sidebar" onClick={onToggle}>
        <Menu size={22} aria-hidden="true" />
      </button>

      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}

      <aside id="app-sidebar" className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Điều hướng chính">
        <div className="sidebar-top">
          <Link to="/" className="sidebar-brand" aria-label="Vibe Mapping" onClick={onClose}>
            <span className="sidebar-brand-mark">
              <LogoMark />
            </span>
            <span className="sidebar-brand-text" aria-hidden="true">
              <span className="sidebar-brand-vibe">Vibe</span>
              <span className="sidebar-brand-mapping">Mapping</span>
            </span>
          </Link>
          <button type="button" className="sidebar-close" aria-label="Đóng menu" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}
                onClick={onClose}
              >
                <span className="sidebar-link-icon">
                  <Icon size={20} />
                </span>
                <span className="sidebar-link-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
