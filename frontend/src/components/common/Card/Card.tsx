import React from 'react';
import './Card.css';

export interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  action,
  className = '',
  noPadding = false,
  interactive = false,
}) => {
  return (
    <div className={`app-card ${interactive ? 'is-interactive' : ''} ${className}`}>
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
