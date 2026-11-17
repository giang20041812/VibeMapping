import React from 'react';
import { PROFICIENCY_LABEL, PROFICIENCY_LEVELS } from '../portfolio.constants';

interface Props {
  value: number | null;
  onChange: (level: number) => void;
  label: string;
  disabled?: boolean;
  /** Hiện tên mức đang chọn ngay dưới dãy nút */
  showCaption?: boolean;
}

/** Chọn mức thành thạo 1–5; rê chuột hoặc chọn để thấy tên mức */
export const LevelPicker: React.FC<Props> = ({ value, onChange, label, disabled = false, showCaption = false }) => (
  <div className="pf-level">
    <div className="pf-level-row" role="radiogroup" aria-label={label}>
      {PROFICIENCY_LEVELS.map((level) => {
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            className={`pf-level-btn${active ? ' is-active' : ''}${value !== null && level <= value ? ' is-filled' : ''}`}
            title={`${level} · ${PROFICIENCY_LABEL[level]}`}
            disabled={disabled}
            onClick={() => onChange(level)}
          >
            {level}
          </button>
        );
      })}
    </div>
    {showCaption && <span className="pf-level-caption">{value !== null ? PROFICIENCY_LABEL[value] : 'Chưa chấm'}</span>}
  </div>
);
