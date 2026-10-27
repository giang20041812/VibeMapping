import React from 'react';
import './Spinner.css';

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Đang tải' }) => (
  <span className="app-spinner" role="status" aria-label={label}>
    <span className="spinner-ring" />
  </span>
);
