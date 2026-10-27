import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogoMark } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import type { UserRole } from '../../modules/auth/auth.types';
import { PageSkeleton } from './PageSkeleton';
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

/** Chỉ cho vai trò được liệt kê (trang quản trị: system_admin); vai trò khác về trang chủ */
export const RequireRole: React.FC<{ roles: UserRole[] }> = ({ roles }) => {
  const { profile, isProfileLoading } = useAuth();
  if (isProfileLoading) return <PageSkeleton />;
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <Outlet />;
};

/** Trang dành cho khách (đăng nhập, đăng ký): đã đăng nhập thì chuyển vào ứng dụng */
export const GuestOnly: React.FC = () => {
  const { session, isLoading } = useAuth();
  if (isLoading) return <FullPageLoader />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
};
