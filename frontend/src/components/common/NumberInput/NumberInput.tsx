import React from 'react';
import { Input, type InputProps } from '../Input/Input';

export interface FormatNumberOptions {
  allowDecimals?: boolean;
  decimals?: number;
  allowNegative?: boolean;
  autoScaleMillion?: boolean;
}

export function formatNumberInput(raw: string, options: FormatNumberOptions = {}): string {
  const {
    allowDecimals = true,
    decimals = 2,
    allowNegative = false,
    autoScaleMillion = false,
  } = options;

  if (!raw) return '';

  let val = raw.trim();

  // Handle thousand-separated VND amount pasted, e.g. "30.000.000" or "30,000,000"
  if (autoScaleMillion) {
    const dotMatches = (val.match(/\./g) || []).length;
    const commaMatches = (val.match(/,/g) || []).length;
    if (dotMatches > 1 || commaMatches > 1) {
      const cleanDigits = val.replace(/\D/g, '');
      const asNum = Number(cleanDigits);
      if (asNum >= 100_000) {
        val = String(asNum / 1_000_000);
      }
    } else {
      const cleanDigits = val.replace(/\D/g, '');
      if (cleanDigits.length >= 7 && !val.includes('.') && !val.includes(',')) {
        val = String(Number(cleanDigits) / 1_000_000);
      }
    }
  }

  // Convert comma to dot
  val = val.replace(/,/g, '.');

  // Check negative
  let isNegative = false;
  if (allowNegative && val.startsWith('-')) {
    isNegative = true;
    val = val.slice(1);
  }

  // Remove any character that is not a digit or dot
  val = val.replace(/[^0-9.]/g, '');

  if (!allowDecimals) {
    val = val.replace(/\./g, '');
  } else {
    // Keep at most 1 decimal dot
    const parts = val.split('.');
    if (parts.length > 2) {
      val = `${parts[0]}.${parts.slice(1).join('')}`;
    }
  }

  // If starts with dot, e.g. ".5" -> "0.5"
  if (val.startsWith('.')) {
    val = `0${val}`;
  }

  // Remove leading zeros if not "0." and not "0"
  if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
    val = val.replace(/^0+/, '');
    if (val === '' || val.startsWith('.')) {
      val = `0${val}`;
    }
  }

  // Limit decimal places
  if (allowDecimals && val.includes('.')) {
    const [integerPart, decimalPart] = val.split('.');
    val = `${integerPart}.${decimalPart.slice(0, decimals)}`;
  }

  return isNegative && val ? `-${val}` : val;
}

export interface NumberInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value?: string | number | null;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string, numValue: number | null) => void;
  min?: number;
  max?: number;
  decimals?: number;
  allowDecimals?: boolean;
  allowNegative?: boolean;
  autoScaleMillion?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value = '',
  onChange,
  onValueChange,
  onBlur,
  min,
  max,
  decimals = 2,
  allowDecimals = true,
  allowNegative = false,
  autoScaleMillion = false,
  inputMode,
  ...props
}) => {
  const displayValue = value === null || value === undefined ? '' : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNumberInput(e.target.value, {
      allowDecimals,
      decimals,
      allowNegative,
      autoScaleMillion,
    });
    e.target.value = formatted;
    const num = formatted && formatted !== '.' ? Number(formatted) : null;
    onValueChange?.(formatted, Number.isFinite(num) ? num : null);
    onChange?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let clean = e.target.value;
    if (clean.endsWith('.')) {
      clean = clean.slice(0, -1);
    }
    if (clean !== e.target.value) {
      e.target.value = clean;
      const num = clean ? Number(clean) : null;
      onValueChange?.(clean, Number.isFinite(num) ? num : null);
      onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
    }
    onBlur?.(e);
  };

  return (
    <Input
      {...props}
      value={displayValue}
      inputMode={inputMode ?? (allowDecimals ? 'decimal' : 'numeric')}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

