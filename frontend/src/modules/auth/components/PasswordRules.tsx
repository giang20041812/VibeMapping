import React from 'react';
import { Check } from 'lucide-react';
import { PASSWORD_RULES } from '../auth.validation';
import './PasswordRules.css';

export const PasswordRules: React.FC<{ value: string }> = ({ value }) => (
  <ul className="password-rules" aria-label="Yêu cầu mật khẩu">
    {PASSWORD_RULES.map((rule) => {
      const passed = rule.test(value);
      return (
        <li key={rule.key} className={`password-rule ${passed ? 'is-passed' : ''}`}>
          <Check size={12} aria-hidden="true" />
          <span>{rule.label}</span>
          <span className="sr-only">{passed ? 'đã đạt' : 'chưa đạt'}</span>
        </li>
      );
    })}
  </ul>
);
