import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../auth-form.css';

/** Đường về trang giới thiệu, đặt ở mép phải thanh trên của khung đăng nhập / đăng ký */
export const AuthHomeLink: React.FC = () => (
  <Link to="/" className="auth-home">
    <ArrowLeft size={16} aria-hidden="true" />
    Về trang chủ
  </Link>
);
