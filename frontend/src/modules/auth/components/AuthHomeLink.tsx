import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const AuthHomeLink: React.FC = () => (
  <Link to="/" className="auth-home">
    <ArrowLeft size={16} aria-hidden="true" />
    Về trang chủ
  </Link>
);
