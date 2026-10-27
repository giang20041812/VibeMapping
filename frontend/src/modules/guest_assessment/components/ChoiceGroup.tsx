import { useId } from 'react';
import './ChoiceGroup.css';

export interface ChoiceOption<T extends string | number> {
  label: string;
  value: T;
}

interface ChoiceGroupProps<T extends string | number> {
  label: string;
  name: string;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
}

export function ChoiceGroup<T extends string | number>({ label, name, options, value, onChange, error }: ChoiceGroupProps<T>) {
  const errorId = useId();
  return (
    <fieldset className={`choice-group ${error ? 'has-error' : ''}`} aria-describedby={error ? errorId : undefined}>
      <legend className="input-label">
        {label}
        <span className="input-required" aria-hidden="true"> *</span>
      </legend>
      <div className="choice-options">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label key={String(option.value)} className={`choice-option ${selected ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name={name}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="choice-option-input"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <span id={errorId} className="input-error-msg" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}
