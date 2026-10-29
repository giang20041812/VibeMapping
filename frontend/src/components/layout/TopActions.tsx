import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import { AccountMenu } from './AccountMenu';
import { NotificationMenu } from './NotificationMenu';
import './TopActions.css';

/**
 * Góc phải trên cùng, không có thanh nền nên không che nội dung trang.
 * Đã đăng nhập: thông báo và avatar. Chưa đăng nhập: nút đăng nhập và đăng ký.
 */
export const TopActions: React.FC = () => {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;

  if (!session) {
    return (
      <div className="top-actions">
        <Link to="/dang-nhap">
          <Button variant="outline">Đăng nhập</Button>
        </Link>
        <Link to="/dang-ky">
          <Button>Đăng ký</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="top-actions">
      <NotificationMenu />
      <AccountMenu />
    </div>
  );
};
