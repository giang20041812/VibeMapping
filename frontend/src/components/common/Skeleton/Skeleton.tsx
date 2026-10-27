import React from 'react';
import './Skeleton.css';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`app-skeleton ${className}`} aria-hidden="true" />
);
