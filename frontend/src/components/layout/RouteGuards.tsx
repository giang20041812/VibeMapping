import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogoMark } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import './RouteGuards.css';

const FullPageLoader: React.FC = () => (
  <div className="full-page-loader" role="status" aria-label="Đang tải">
    <div className="full-page-loader-mark">
      <LogoMark animated />
    </div>
  </div>
);

/** Chỉ cho người đã đăng nhập; chưa đăng nhập thì chuyển về trang đăng nhập */
export const RequireAuth: React.FC = () => {
  const { session, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullPageLoader />;
  if (!session) return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  return <Outlet />;
};

/** Trang dành cho khách (đăng nhập, đăng ký): đã đăng nhập thì chuyển vào ứng dụng */
export const GuestOnly: React.FC = () => {
  const { session, isLoading } = useAuth();
  if (isLoading) return <FullPageLoader />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
};
