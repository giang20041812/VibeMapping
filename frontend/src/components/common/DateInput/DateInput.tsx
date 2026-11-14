import React from 'react';
import { Calendar } from 'lucide-react';
import { Input, type InputProps } from '../Input/Input';
import { formatDateInput } from '../../../modules/profile/profile.logic';

export interface DateInputProps extends Omit<InputProps, 'onChange'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
}

export const DateInput: React.FC<DateInputProps> = ({
  value = '',
  onChange,
  onValueChange,
  placeholder = 'dd/mm/yyyy',
  inputMode = 'numeric',
  autoComplete = 'bday',
  maxLength = 10,
  leftIcon = <Calendar size={16} />,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value, value);
    e.target.value = formatted;
    onValueChange?.(formatted);
    onChange?.(e);
  };

  return (
    <Input
      {...props}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete}
      maxLength={maxLength}
      leftIcon={leftIcon}
      onChange={handleChange}
    />
  );
};
