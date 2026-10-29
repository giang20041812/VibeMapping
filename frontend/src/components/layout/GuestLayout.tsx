import React from 'react';
import { Outlet } from 'react-router-dom';
import { Logo } from '../common';
import './GuestLayout.css';

/** Khung trang cho người được mời đánh giá, không cần tài khoản */
export const GuestLayout: React.FC = () => (
  <div className="guest-shell">
    <header className="guest-header">
      <Logo variant="full" size="md" />
    </header>
    <main className="guest-main">
      <Outlet />
    </main>
  </div>
);
