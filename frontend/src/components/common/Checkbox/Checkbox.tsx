import React, { useEffect, useId, useRef } from 'react';
import './Checkbox.css';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Trạng thái chọn một phần (chọn tất cả trong bảng) */
  indeterminate?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  indeterminate = false,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <label htmlFor={inputId} className={`app-checkbox ${props.disabled ? 'is-disabled' : ''} ${className}`}>
      <input
        ref={inputRef}
        id={inputId}
        type="checkbox"
        className="app-checkbox-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        {...props}
      />
      {label && <span className="app-checkbox-label">{label}</span>}
    </label>
  );
};
