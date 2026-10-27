import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { LogoMark } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import { navItemsFor } from './navigation';
import './Sidebar.css';

/** Còn true từ lúc chọn một mục tới khi chuột rời thanh; giữ được cả khi khung trang được dựng lại */
let collapseUntilPointerLeaves = false;

export interface SidebarProps {
  /** Điện thoại: thanh trượt ra từ mép trái khi true */
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * Thanh điều hướng bên trái, thu gọn thành cột biểu tượng; rê chuột (hoặc Tab) vào thì mở rộng hiện chữ.
 * Chọn một mục thì thanh tự gập lại ngay, kể cả khi chuột còn nằm trên thanh, và chỉ mở lại khi chuột rời đi rồi vào lại.
 * Điện thoại: ẩn hẳn, mở bằng nút ở góc trên bên trái.
 */
export const Sidebar: React.FC<SidebarProps> = ({ open, onToggle, onClose }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const items = navItemsFor(profile?.role);
  const asideRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => collapseUntilPointerLeaves);
  const lastPath = useRef(location.pathname);

  /* Gập lại mỗi khi sang trang khác; bỏ focus khỏi thanh để :focus-within không giữ nó mở */
  const collapse = () => {
    collapseUntilPointerLeaves = true;
    setCollapsed(true);
    const active = document.activeElement as HTMLElement | null;
    if (active && asideRef.current?.contains(active)) active.blur();
  };

  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    collapse();
  }, [location.pathname]);

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

      <aside
        ref={asideRef}
        id="app-sidebar"
        className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}
        aria-label="Điều hướng chính"
        onPointerLeave={() => {
          collapseUntilPointerLeaves = false;
          setCollapsed(false);
        }}
      >
        <div className="sidebar-top">
          <Link to="/" className="sidebar-brand" aria-label="Vibe Mapping" onClick={collapse}>
            <span className="sidebar-brand-word" aria-hidden="true">
              <span className="sidebar-brand-mark">
                <LogoMark />
              </span>
              <span className="sidebar-brand-text">
                <span className="sidebar-brand-vibe">ibe</span>
                <span className="sidebar-brand-mapping">Mapping</span>
              </span>
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
                onClick={collapse}
              >
                <span className="sidebar-link-icon">
                  <Icon size={22} />
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
