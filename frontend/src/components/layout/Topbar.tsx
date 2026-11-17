import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../modules/auth/AuthContext';
import { BrandLink } from './BrandLink';
import { topbarItemsFor } from './navigation';
import { TopActions } from './TopActions';
import '../common/Button/Button.css';
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
  const { isGuest } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

      <header className={`topbar ${open ? 'is-open' : ''} ${isScrolled ? 'is-scrolled' : ''}`}>
        <div className="topbar-inner">
          <BrandLink className="topbar-brand" onClick={onClose} />

          <nav id="topbar-links" className="topbar-links hover-sweep-group" aria-label="Điều hướng chính">
            {topbarItemsFor(isGuest).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `topbar-link ${item.cta ? 'topbar-link-cta' : 'hover-sweep hover-sweep-bottom'} ${isActive ? 'is-active' : ''}`
                  }
                  onClick={onClose}
                >
                  <span className={item.cta ? 'app-button btn-primary btn-md topbar-cta' : 'topbar-link-label'}>
                    {Icon && <Icon size={18} />}
                    <span className="roll">
                      <span className="roll-inner" data-text={item.label}>
                        {item.label}
                      </span>
                    </span>
                  </span>
                </NavLink>
              );
            })}
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
