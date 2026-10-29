import React from 'react';
import { useAuth } from '../../modules/auth/AuthContext';
import { AppLayout } from './AppLayout';
import { PublicLayout } from './PublicLayout';

/** Trang dùng chung cho khách và người có tài khoản: khách thấy thanh ngang, người có tài khoản thấy thanh bên */
export const ShellLayout: React.FC = () => {
  const { isGuest } = useAuth();
  return isGuest ? <PublicLayout /> : <AppLayout />;
};
