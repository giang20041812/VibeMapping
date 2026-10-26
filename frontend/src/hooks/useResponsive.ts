import { useState, useEffect } from 'react';

export interface ResponsiveState {
  isMobile: boolean;    // < 768px (Android, Samsung Galaxy)
  isTablet: boolean;    // 768px - 1024px
  isDesktop: boolean;   // >= 1024px
  width: number;
}

/**
 * Custom hook to monitor viewport changes across Samsung, Android, and PC
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      width,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setState({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        width,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
