import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import './AppLayout.css';
import './PublicLayout.css';

/**
 * Khung trang không có thanh bên: thanh điều hướng ngang ở trên, nội dung phủ cả chiều ngang.
 * Dùng cho trang giới thiệu, khám phá trường và khi khách làm bài test.
 */
export const PublicLayout: React.FC = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setMenuOpen((value) => !value), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="public-shell">
      <Topbar open={menuOpen} onToggle={toggleMenu} onClose={closeMenu} />
      <main className="public-main">
        <div key={location.pathname} className="app-container page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
