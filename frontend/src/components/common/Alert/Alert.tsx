import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import './Alert.css';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/** Thông báo luôn có biểu tượng và chữ mô tả, không chỉ dựa vào màu */
export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, children, className = '' }) => {
  const Icon = ICONS[variant];
  return (
    <div className={`app-alert alert-${variant} ${className}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon className="alert-icon" size={18} aria-hidden="true" />
      <div className="alert-content">
        {title && <strong className="alert-title">{title}</strong>}
        {children && <div className="alert-text">{children}</div>}
      </div>
    </div>
  );
};
