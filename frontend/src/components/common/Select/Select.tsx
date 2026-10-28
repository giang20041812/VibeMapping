import React, { useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Dòng đầu cho giá trị rỗng; bỏ trống thì không có lựa chọn rỗng */
  emptyLabel?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  emptyLabel,
  error,
  className = '',
  id,
  required,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className={`app-select-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={selectId} className="select-field-label">
          {label}
          {required && <span className="select-field-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="select-field-wrapper">
        <select
          id={selectId}
          className="app-select-field"
          value={value}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        >
          {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="select-field-chevron" aria-hidden="true" />
      </div>
      {error && (
        <span id={errorId} className="select-field-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
};
