import React from 'react';
import { Outlet } from 'react-router-dom';
import { Logo } from '../common';
import './AuthLayout.css';

export const AuthLayout: React.FC = () => (
  <div className="auth-shell">
    <aside className="auth-hero">
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
