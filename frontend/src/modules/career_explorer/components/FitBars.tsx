import React from 'react';
import type { CareerComponentResult } from '../../../domain/assessmentRules';

const PARTS: Array<{ key: 'g1toG5' | 'g6' | 'g7'; label: string; tone: string }> = [
  { key: 'g1toG5', label: 'Năng lực', tone: 'sky' },
  { key: 'g6', label: 'Sở thích', tone: 'magenta' },
  { key: 'g7', label: 'Động lực', tone: 'gold' },
];

/** Ba thanh thành phần của mức phù hợp */
export const FitBars: React.FC<{ result: CareerComponentResult }> = ({ result }) => (
  <ul className="fit-bars">
    {PARTS.map(({ key, label, tone }) => {
      const percent = result[key].matchPercent;
      return (
        <li key={key} className={`fit-bar fit-bar-${tone}`}>
          <span className="fit-bar-label">{label}</span>
          <span className="fit-bar-track">
            <span className="fit-bar-fill" style={{ width: `${percent ?? 0}%` }} />
          </span>
          <span className="fit-bar-value">{percent === null ? '–' : `${Math.round(percent)}%`}</span>
        </li>
      );
    })}
  </ul>
);
