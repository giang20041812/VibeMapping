import React, { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useParallax } from '../../hooks/useParallax';
import { Logo } from '../common';
import { AuthHeroScene } from './AuthHeroScene';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => {
  const heroRef = useRef<HTMLElement>(null);
  useParallax(heroRef);

  return (
    <div className="auth-shell">
      <aside className="auth-hero" ref={heroRef}>
        <AuthHeroScene />
        <div className="auth-hero-content">
          <Logo variant="stacked" size="hero" animated className="auth-hero-logo" />
          <p className="auth-hero-slogan">Biết mình là ai, vững bước tương lai.</p>
          <p className="auth-hero-slogan-sub">Vẽ bản đồ chất, để tương lai phất.</p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
