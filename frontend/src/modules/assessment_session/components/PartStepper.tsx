import React from 'react';
import { Check, Lock } from 'lucide-react';
import { PARTS } from '../assessmentSession.constants';
import type { PartNumber } from '../assessmentSession.types';
import './PartStepper.css';

export interface PartStepperProps {
  currentPart: PartNumber | null;
  /** Phần cao nhất đã mở khóa (5 nghĩa là đã xong cả bốn phần) */
  unlockedPart: number;
  onSelect: (part: PartNumber) => void;
}

export const PartStepper: React.FC<PartStepperProps> = ({ currentPart, unlockedPart, onSelect }) => (
  <ol className="part-stepper" aria-label="Các phần của bài đánh giá">
    {PARTS.map((part) => {
      const done = part.number < unlockedPart;
      const locked = part.number > unlockedPart;
      const current = part.number === currentPart;
      const state = done ? 'is-done' : locked ? 'is-locked' : 'is-open';
      return (
        <li key={part.number} className={`part-step part-step-${part.number} ${state} ${current ? 'is-current' : ''}`}>
          <button
            type="button"
            className="part-step-button"
            aria-disabled={locked}
            onClick={() => onSelect(part.number)}
            aria-current={current ? 'step' : undefined}
          >
            <span className="part-step-marker" aria-hidden="true">
              {done ? <Check size={16} /> : locked ? <Lock size={14} /> : part.number}
            </span>
            <span className="part-step-name">{part.short}</span>
            <span className="sr-only">{done ? 'đã xong' : locked ? 'chưa mở' : 'đang làm'}</span>
          </button>
        </li>
      );
    })}
  </ol>
);
