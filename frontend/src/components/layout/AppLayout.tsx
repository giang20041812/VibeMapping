import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopActions } from './TopActions';
import { HomeBackdrop } from '../../modules/home/HomeBackdrop';
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
      <HomeBackdrop />
      <Sidebar open={menuOpen} onToggle={toggleMenu} onClose={closeMenu} />
      <TopActions />
      <main className="app-main-content">
        <div key={location.pathname} className="app-container page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
