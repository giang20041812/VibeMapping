import React, { useId } from 'react';
import './Textarea.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, className = '', id, ...props }) => {
  const generatedId = useId();
  const fieldId = id || generatedId;
  return (
    <div className={`app-textarea-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="input-label">
          {label}
        </label>
      )}
      <textarea id={fieldId} className="app-textarea-field" aria-invalid={error ? true : undefined} {...props} />
      {error && (
        <span className="input-error-msg" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
