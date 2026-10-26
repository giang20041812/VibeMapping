import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  leftIcon,
  rightAction,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`app-input-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <div className="input-control-wrapper">
        {leftIcon && <span className="input-icon-left">{leftIcon}</span>}
        <input
          id={inputId}
          className={`app-input-field ${leftIcon ? 'with-left-icon' : ''} ${rightAction ? 'with-right-action' : ''}`}
          {...props}
        />
        {rightAction && <div className="input-action-right">{rightAction}</div>}
      </div>
      {error && <span className="input-error-msg">{error}</span>}
    </div>
  );
};
