import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/common';
import './NotFoundPage.css';

export const NotFoundPage: React.FC = () => (
  <div className="not-found">
    <Logo variant="stacked" size="xl" animated />
    <p className="not-found-code">404</p>
    <p className="not-found-title">Không tìm thấy trang</p>
    <Link to="/" className="not-found-link">
      Về trang chủ
    </Link>
  </div>
);
