import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '../Input/Input';
import type { InputProps } from '../Input/Input';
import './PasswordInput.css';

export const PasswordInput: React.FC<Omit<InputProps, 'type' | 'rightAction' | 'leftIcon'>> = (props) => {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      leftIcon={<Lock size={16} />}
      rightAction={
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  );
};
