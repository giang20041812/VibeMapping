import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import './AppLayout.css';

/** Màn hình làm bài ẩn nút mở menu để tập trung vào câu hỏi */
const FOCUS_ROUTE = /^\/danh-gia-ca-nhan\/.+/;

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const focusMode = FOCUS_ROUTE.test(location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setMenuOpen((value) => !value), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app-shell ${focusMode ? 'is-focus' : ''}`}>
      <Navbar open={menuOpen} onToggle={toggleMenu} onClose={closeMenu} />
      <main className="app-main-content">
        <div key={location.pathname} className="app-container page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
