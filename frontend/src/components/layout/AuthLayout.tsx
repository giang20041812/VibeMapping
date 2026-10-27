import React from 'react';
import { Outlet } from 'react-router-dom';
import { Logo } from '../common';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => (
  <div className="auth-shell">
    <aside className="auth-hero">
      <svg className="auth-hero-contours" viewBox="0 0 400 400" aria-hidden="true">
        <path d="M-20 300 C 60 240, 120 330, 200 270 S 340 220, 430 280" />
        <path d="M-20 250 C 60 190, 120 280, 200 220 S 340 170, 430 230" />
        <path d="M-20 200 C 60 140, 120 230, 200 170 S 340 120, 430 180" />
        <path d="M-20 150 C 60 90, 120 180, 200 120 S 340 70, 430 130" />
        <path d="M-20 100 C 60 40, 120 130, 200 70 S 340 20, 430 80" />
      </svg>
      <span className="auth-hero-orb auth-hero-orb-1" aria-hidden="true" />
      <span className="auth-hero-orb auth-hero-orb-2" aria-hidden="true" />
      <span className="auth-hero-orb auth-hero-orb-3" aria-hidden="true" />

      <div className="auth-hero-content">
        <Logo variant="stacked" size="hero" tone="inverse" animated className="auth-hero-logo" />
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
