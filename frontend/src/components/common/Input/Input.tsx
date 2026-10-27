import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';
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
  required,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={`app-input-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && <span className="input-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="input-control-wrapper">
        {leftIcon && <span className="input-icon-left">{leftIcon}</span>}
        <input
          id={inputId}
          className={`app-input-field ${leftIcon ? 'with-left-icon' : ''} ${rightAction ? 'with-right-action' : ''}`}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {rightAction && <div className="input-action-right">{rightAction}</div>}
      </div>
      {error && (
        <span id={errorId} className="input-error-msg" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
};
