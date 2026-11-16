import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Chuyển trang luôn bắt đầu ở đầu trang (hoặc ở mục có #neo); đổi bộ lọc trên cùng một trang thì giữ nguyên vị trí cuộn */
export const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useLayoutEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      return;
    }
    /* behavior 'instant' bỏ qua scroll-behavior: smooth của trang giới thiệu để không "vuốt" từ vị trí cũ */
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
};
