import React, { useRef } from 'react';
import { AlertCircle } from 'lucide-react';

const LENGTH = 6;

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  error?: string | null;
}

/** Sáu ô, mỗi ô một chữ số. Dán cả mã thì điền lần lượt. */
export const OtpDigits: React.FC<Props> = ({ value, onChange, disabled, error }) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focusAt = (index: number) => {
    const box = refs.current[Math.max(0, Math.min(LENGTH - 1, index))];
    box?.focus();
    box?.select();
  };

  const write = (index: number, digit: string) => {
    const next = value.slice();
    next[index] = digit;
    onChange(next);
  };

  const fillFrom = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, LENGTH - index).split('');
    if (digits.length === 0) return;
    const next = value.slice();
    digits.forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    onChange(next);
    focusAt(index + digits.length);
  };

  return (
    <div className="otp-field">
    <div className="otp-digits" role="group" aria-label="Mã OTP 6 số" aria-invalid={error ? true : undefined} aria-describedby={error ? 'otp-error' : undefined}>
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className={`otp-digit${error ? ' is-error' : ''}`}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Số thứ ${index + 1}`}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw.length > 1) {
              fillFrom(index, raw);
              return;
            }
            const nextDigit = raw.replace(/\D/g, '').slice(-1);
            write(index, nextDigit);
            if (nextDigit) focusAt(index + 1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index]) {
              event.preventDefault();
              write(index - 1, '');
              focusAt(index - 1);
            }
            if (event.key === 'ArrowLeft') focusAt(index - 1);
            if (event.key === 'ArrowRight') focusAt(index + 1);
          }}
          onPaste={(event) => {
            event.preventDefault();
            fillFrom(index, event.clipboardData.getData('text'));
          }}
        />
      ))}
    </div>
    {error && (
      <span id="otp-error" className="otp-error" role="alert">
        <AlertCircle size={14} aria-hidden="true" />
        {error}
      </span>
    )}
    </div>
  );
};

export const EMPTY_OTP = Array.from({ length: LENGTH }, () => '');
