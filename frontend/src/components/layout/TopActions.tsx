import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../common';
import { useAuth } from '../../modules/auth/AuthContext';
import { AccountMenu } from './AccountMenu';
import { NotificationMenu } from './NotificationMenu';
import './TopActions.css';

/**
 * Đã đăng nhập: thông báo và avatar. Chưa đăng nhập: nút đăng nhập và đăng ký.
 * Mặc định nổi ở góc phải trên cùng (không có thanh nền nên không che nội dung trang);
 * `inline` đặt vào trong thanh điều hướng trên cùng.
 */
export const TopActions: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const { isGuest, isLoading } = useAuth();
  if (isLoading) return null;
  const className = `top-actions ${inline ? 'is-inline' : ''}`;

  if (isGuest) {
    return (
      <div className={className}>
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
    <div className={className}>
      <NotificationMenu />
      <AccountMenu />
    </div>
  );
};
