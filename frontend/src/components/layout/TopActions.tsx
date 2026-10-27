import React from 'react';
import { AccountMenu } from './AccountMenu';
import { NotificationMenu } from './NotificationMenu';
import './TopActions.css';

/** Hai icon nổi ở góc phải trên cùng: thông báo và avatar. Không có thanh nền nên không che nội dung trang. */
export const TopActions: React.FC = () => (
  <div className="top-actions">
    <NotificationMenu />
    <AccountMenu />
  </div>
);
