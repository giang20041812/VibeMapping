import React from 'react';
import './Card.css';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  action,
  className = '',
  noPadding = false,
}) => {
  return (
    <div className={`app-card ${className}`}>
      {(title || action) && (
        <div className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className={`card-body ${noPadding ? 'no-padding' : ''}`}>{children}</div>
    </div>
  );
};
