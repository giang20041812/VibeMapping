import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthContext';
import { isLearnerRole } from '../../modules/profile/profile.logic';
import { Sidebar } from './Sidebar';
import { TopActions } from './TopActions';
import './AppLayout.css';

/** Màn hình làm bài ẩn nút mở menu để tập trung vào câu hỏi */
const FOCUS_ROUTE = /^\/danh-gia-ca-nhan\/.+/;

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { profile } = useAuth();
  const learner = isLearnerRole(profile?.role);
  const focusMode = FOCUS_ROUTE.test(location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setMenuOpen((value) => !value), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  /* Nút kiểu hình dán chỉ áp dụng phía học sinh; đặt trên <html> để modal cũng nhận được */
  useEffect(() => {
    if (!learner) return;
    document.documentElement.dataset.ui = 'cartoon';
    return () => {
      delete document.documentElement.dataset.ui;
    };
  }, [learner]);

  return (
    <div className={`app-shell ${focusMode ? 'is-focus' : ''}`}>
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
