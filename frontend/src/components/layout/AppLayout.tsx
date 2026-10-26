import React from 'react';
import { Header } from './Header';
import './AppLayout.css';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main-content">
        <div className="app-container">{children}</div>
      </main>
      <footer className="app-footer">
        <div className="app-container footer-container">
          <p className="footer-copyright">
            © {new Date().getFullYear()} VibeMapping • Chuẩn hóa theo AI Ruleset & Design System
          </p>
          <div className="footer-meta">
            <span>TypeScript Frontend</span>
            <span className="dot-sep">•</span>
            <span>Supabase Backend</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
